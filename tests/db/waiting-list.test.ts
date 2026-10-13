import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("the waiting list", () => {
  it("is for owners and admins only, and holds each person once", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const jo = await tx.createCustomer(
        "Jo Waiting",
        "jo.waiting@example.test",
      );
      const admin = await tx.createStaff("admin");
      const door = await tx.createStaff("door");
      const customer = await tx.createUser();

      await tx.as(admin);
      await tx.query(
        "insert into public.waitlist (event_id, customer_id) values ($1, $2)",
        [event, jo],
      );
      expect(
        await tx.expectError(
          "insert into public.waitlist (event_id, customer_id) values ($1, $2)",
          [event, jo],
        ),
      ).toMatch(/waitlist_once_per_event/);

      for (const who of [door, customer]) {
        await tx.as(who);
        const { rowCount } = await tx.query("select 1 from public.waitlist");
        expect(rowCount).toBe(0);
      }
      await tx.asAnonymous();
      expect(await tx.expectError("select 1 from public.waitlist")).toMatch(
        /permission denied/,
      );
    });
  });

  it("needs an offer's dates, and only book_from_waitlist marks someone booked", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const jo = await tx.createCustomer(
        "Jo Waiting",
        "jo.waiting@example.test",
      );
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.waitlist (event_id, customer_id) values ($1, $2) returning id",
        [event, jo],
      );
      const id = rows[0]!.id;
      expect(
        await tx.expectError(
          "update public.waitlist set status = 'offered' where id = $1",
          [id],
        ),
      ).toMatch(/waitlist_offer_dates/);
      await tx.query(
        "update public.waitlist set status = 'offered', offered_at = now(), offer_expires_on = current_date + 3 where id = $1",
        [id],
      );
      expect(
        await tx.expectError(
          "update public.waitlist set status = 'booked' where id = $1",
          [id],
        ),
      ).toMatch(/row-level security|waitlist_booked_has_booking/);
    });
  });

  it("books someone in at the option's price, all at once", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ capacity: 1 });
      const option = await tx.createTicketType(event, {
        pricePence: 24500,
        depositPence: 8500,
      });
      const jo = await tx.createCustomer(
        "Jo Waiting",
        "jo.waiting@example.test",
      );
      const bea = await tx.createCustomer(
        "Bea Waiting",
        "bea.waiting@example.test",
      );
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      const { rows } = await tx.query<{ id: string; customer_id: string }>(
        `insert into public.waitlist (event_id, customer_id) values ($1, $2), ($1, $3)
         returning id, customer_id`,
        [event, jo, bea],
      );
      const joEntry = rows.find((row) => row.customer_id === jo)!.id;
      const beaEntry = rows.find((row) => row.customer_id === bea)!.id;

      const booked = await tx.query<{ id: string }>(
        "select public.book_from_waitlist($1, $2) as id",
        [joEntry, option],
      );
      const bookingId = booked.rows[0]!.id;
      const booking = await tx.query(
        "select price_pence, deposit_pence, customer_id from public.bookings where id = $1",
        [bookingId],
      );
      expect(booking.rows[0]).toEqual({
        price_pence: 24500,
        deposit_pence: 8500,
        customer_id: jo,
      });
      const entry = await tx.query(
        "select status, booking_id from public.waitlist where id = $1",
        [joEntry],
      );
      expect(entry.rows[0]).toEqual({
        status: "booked",
        booking_id: bookingId,
      });

      // The event is now full, so Bea can't be booked in, and stays waiting.
      expect(
        await tx.expectError("select public.book_from_waitlist($1, $2)", [
          beaEntry,
          option,
        ]),
      ).toMatch(/full|places/i);
      const still = await tx.query(
        "select status from public.waitlist where id = $1",
        [beaEntry],
      );
      expect(still.rows[0]?.status).toBe("waiting");

      // Booking the same person twice isn't possible.
      expect(
        await tx.expectError("select public.book_from_waitlist($1, $2)", [
          joEntry,
          option,
        ]),
      ).toMatch(/isn't waiting/);
    });
  });

  it("can't be used by door staff to book people in", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const option = await tx.createTicketType(event);
      const jo = await tx.createCustomer(
        "Jo Waiting",
        "jo.waiting@example.test",
      );
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.waitlist (event_id, customer_id) values ($1, $2) returning id",
        [event, jo],
      );
      await tx.as(await tx.createStaff("door"));
      expect(
        await tx.expectError("select public.book_from_waitlist($1, $2)", [
          rows[0]!.id,
          option,
        ]),
      ).toMatch(/Only owners and admins/);
    });
  });
});
