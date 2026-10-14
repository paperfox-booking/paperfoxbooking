import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

const REFUND =
  "insert into public.refunds (booking_id, amount_pence, refunded_on, reason) values ($1, $2, '2026-11-02', 'Cancelled') returning id";

describe("refunds", () => {
  it("are recorded by owners and admins, and removed with a reason, never edited", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      await tx.createPayment(booking.id, 19500);
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      const { rows } = await tx.query<{ id: string; recorded_by: string }>(
        `insert into public.refunds (booking_id, amount_pence, method, refunded_on, reason)
         values ($1, 13500, 'bank_transfer', '2026-11-02', 'Cancelled, £60 fee kept')
         returning id, recorded_by`,
        [booking.id],
      );
      const refund = rows[0]!;
      expect(refund.recorded_by).toBe(admin.id);

      expect(
        await tx.expectError(
          "update public.refunds set amount_pence = 1 where id = $1",
          [refund.id],
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError(
          "update public.refunds set deleted_at = now() where id = $1",
          [refund.id],
        ),
      ).toMatch(/refunds_delete_reason/);
      expect(
        await tx.expectError(
          "insert into public.refunds (booking_id, amount_pence, refunded_on, reason) values ($1, 100, '2026-11-02', '  ')",
          [booking.id],
        ),
      ).toMatch(/refunds_reason_length/);
      const removed = await tx.query(
        "update public.refunds set deleted_at = now(), delete_reason = 'Wrong booking' where id = $1",
        [refund.id],
      );
      expect(removed.rowCount).toBe(1);

      const audit = await tx.query(
        `select action, changed_by from public.audit_log
          where table_name = 'refunds' and record_id = $1 order by changed_at, action`,
        [refund.id],
      );
      expect(audit.rows).toEqual([
        { action: "insert", changed_by: admin.id },
        { action: "update", changed_by: admin.id },
      ]);
    });
  });

  it("can never add up to more than has been paid", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      await tx.createPayment(booking.id, 6000);
      await tx.createPayment(booking.id, 13500);
      await tx.as(await tx.createStaff("owner"));

      expect(await tx.expectError(REFUND, [booking.id, 19501])).toMatch(
        /That's more than they've paid\. The most you can refund is £195\./,
      );
      await tx.query(REFUND, [booking.id, 13500]);
      expect(await tx.expectError(REFUND, [booking.id, 6050])).toMatch(
        /The most you can refund is £60\./,
      );
      await tx.query(REFUND, [booking.id, 5950]);
      expect(await tx.expectError(REFUND, [booking.id, 51])).toMatch(
        /The most you can refund is £0\.50\./,
      );
    });
  });

  it("stop a payment being removed if the refunds would then be more than was paid", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const deposit = await tx.createPayment(booking.id, 6000);
      const balance = await tx.createPayment(booking.id, 13500);
      await tx.as(await tx.createStaff("admin"));
      await tx.query(REFUND, [booking.id, 10000]);

      const remove =
        "update public.payments set deleted_at = now(), delete_reason = 'Recorded twice' where id = $1";
      expect(await tx.expectError(remove, [balance])).toMatch(
        /Remove the refund first/,
      );
      // Removing the deposit still leaves £135 paid, which covers £100.
      const removed = await tx.query(remove, [deposit]);
      expect(removed.rowCount).toBe(1);
    });
  });

  it("are hidden from door staff, and customers only see their own", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const people = [];
      for (const name of ["Customer A", "Customer B"]) {
        const user = await tx.createUser(name);
        const customer = await tx.createCustomer(name, user.email, user.id);
        const booking = await tx.createBooking(event, customer);
        await tx.createPayment(booking.id, 6000);
        people.push({ user, booking });
      }
      const [a, b] = people as [(typeof people)[0], (typeof people)[0]];
      const door = await tx.createStaff("door");
      await tx.as(await tx.createStaff("owner"));
      await tx.query(REFUND, [a.booking.id, 1000]);
      await tx.query(REFUND, [b.booking.id, 2000]);

      await tx.as(a.user);
      const own = await tx.query<{ amount_pence: number }>(
        "select amount_pence from public.refunds",
      );
      expect(own.rows).toEqual([{ amount_pence: 1000 }]);
      expect(await tx.expectError(REFUND, [a.booking.id, 100])).toMatch(
        /row-level security/,
      );

      await tx.as(door);
      const seen = await tx.query("select 1 from public.refunds");
      expect(seen.rowCount).toBe(0);
      expect(await tx.expectError(REFUND, [a.booking.id, 100])).toMatch(
        /row-level security/,
      );
    });
  });

  it("gives exactly one of two refunds of the last money at the same moment", async () => {
    const setup = await pool.connect();
    const eventId = randomUUID();
    const customerId = randomUUID();
    let bookingId = "";
    try {
      const venue = await setup.query<{ id: string }>(
        "insert into public.venues (name) values ('Refund race venue') returning id",
      );
      await setup.query(
        `insert into public.events (id, title, venue_id, starts_at, ends_at, balance_due_on, capacity)
         values ($1, 'Refund race', $2, '2043-03-13T09:00:00Z', '2043-03-15T17:00:00Z', '2043-02-01', 5)`,
        [eventId, venue.rows[0]!.id],
      );
      await setup.query(
        "insert into public.customers (id, full_name) values ($1, 'Refunded')",
        [customerId],
      );
      const booking = await setup.query<{ id: string }>(
        "insert into public.bookings (event_id, customer_id, price_pence) values ($1, $2, 19500) returning id",
        [eventId, customerId],
      );
      bookingId = booking.rows[0]!.id;
      await setup.query(
        "insert into public.payments (booking_id, amount_pence, received_on) values ($1, 19500, '2026-10-01')",
        [bookingId],
      );

      const [first, second] = [await pool.connect(), await pool.connect()];
      try {
        await first.query("begin");
        await second.query("begin");
        await first.query(REFUND, [bookingId, 13500]);
        // The second waits for the first to finish, then finds only £60 left.
        const secondAttempt = second
          .query(REFUND, [bookingId, 13500])
          .then(() => "refunded")
          .catch((error: Error) => error.message);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await first.query("commit");
        expect(await secondAttempt).toMatch(/The most you can refund is £60\./);
        await second.query("rollback");
      } finally {
        first.release();
        second.release();
      }

      const { rows } = await setup.query(
        "select coalesce(sum(amount_pence), 0)::int as refunded from public.refunds where booking_id = $1",
        [bookingId],
      );
      expect(rows[0]?.refunded).toBe(13500);
    } finally {
      if (bookingId) {
        await setup.query("delete from public.refunds where booking_id = $1", [
          bookingId,
        ]);
        await setup.query("delete from public.payments where booking_id = $1", [
          bookingId,
        ]);
      }
      await setup.query("delete from public.bookings where event_id = $1", [
        eventId,
      ]);
      await setup.query("delete from public.customers where id = $1", [
        customerId,
      ]);
      await setup.query("delete from public.events where id = $1", [eventId]);
      setup.release();
    }
  });
});
