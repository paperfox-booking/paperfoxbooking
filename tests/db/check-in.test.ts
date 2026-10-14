import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("checking people in", () => {
  it("lets door staff mark someone as arrived, and undo it", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const door = await tx.createStaff("door");
      await tx.as(door);

      const arrived = await tx.query<{ at: Date }>(
        "select public.set_checked_in($1, true) as at",
        [booking.id],
      );
      expect(arrived.rows[0]?.at).toBeInstanceOf(Date);

      // Marking again keeps the first arrival time.
      const again = await tx.query<{ at: Date }>(
        "select public.set_checked_in($1, true) as at",
        [booking.id],
      );
      expect(again.rows[0]?.at).toEqual(arrived.rows[0]?.at);

      const { rows } = await tx.query(
        "select checked_in_by from public.bookings where id = $1",
        [booking.id],
      );
      expect(rows[0]?.checked_in_by).toBe(door.id);

      const undone = await tx.query(
        "select public.set_checked_in($1, false) as at",
        [booking.id],
      );
      expect(undone.rows[0]?.at).toBeNull();

      // Door staff still can't change anything else about the booking.
      const change = await tx.query(
        "update public.bookings set price_pence = 0 where id = $1",
        [booking.id],
      );
      expect(change.rowCount).toBe(0);
    });
  });

  it("isn't allowed for customers, or for cancelled bookings", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const customer = await tx.createUser();
      await tx.as(customer);
      expect(
        await tx.expectError("select public.set_checked_in($1, true)", [
          booking.id,
        ]),
      ).toMatch(/Only the Paper Fox team/);

      await tx.asSuperuser();
      await tx.query(
        "update public.bookings set cancelled_at = now() where id = $1",
        [booking.id],
      );
      const admin = await tx.createStaff("admin");
      await tx.as(admin);
      expect(
        await tx.expectError("select public.set_checked_in($1, true)", [
          booking.id,
        ]),
      ).toMatch(/has been cancelled/);
    });
  });
});
