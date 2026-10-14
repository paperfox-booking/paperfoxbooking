import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("customer_settings", () => {
  it("gives bank details and terms only to people with a booking", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booked = await tx.createUser();
      const browsing = await tx.createUser();
      const customer = await tx.createCustomer(
        "Jo Booked",
        booked.email,
        booked.id,
      );
      await tx.createBooking(event, customer);
      await tx.query(
        "update public.settings set bank_sort_code = '12-34-56', bank_account_number = '12345678'",
      );

      await tx.as(booked);
      const mine = await tx.query<{
        bank_sort_code: string;
        terms_version: number;
      }>(
        "select bank_sort_code, terms_version from public.customer_settings()",
      );
      expect(mine.rows[0]?.bank_sort_code).toBe("12-34-56");
      // Not the email settings.
      expect(
        await tx.expectError(
          "select email_test_address from public.customer_settings()",
        ),
      ).toMatch(/email_test_address/);
      // And still not the settings table itself.
      const { rowCount } = await tx.query("select 1 from public.settings");
      expect(rowCount).toBe(0);

      await tx.as(browsing);
      const none = await tx.query("select * from public.customer_settings()");
      expect(none.rowCount).toBe(0);

      // Once their only booking is cancelled, they don't get them either.
      await tx.asSuperuser();
      await tx.query(
        "update public.bookings set cancelled_at = now() where customer_id = $1",
        [customer],
      );
      await tx.as(booked);
      const cancelled = await tx.query(
        "select * from public.customer_settings()",
      );
      expect(cancelled.rowCount).toBe(0);

      await tx.asAnonymous();
      expect(
        await tx.expectError("select * from public.customer_settings()"),
      ).toMatch(/permission denied/);
    });
  });

  it("lets customers see a draft event they're booked on, and its options", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ status: "draft" });
      const option = await tx.createTicketType(event);
      const booked = await tx.createUser();
      const other = await tx.createUser();
      const customer = await tx.createCustomer(
        "Jo Booked",
        booked.email,
        booked.id,
      );
      await tx.createBooking(event, customer);

      await tx.as(booked);
      const events = await tx.query(
        "select id from public.events where id = $1",
        [event],
      );
      expect(events.rowCount).toBe(1);
      const options = await tx.query(
        "select id from public.ticket_types where id = $1",
        [option],
      );
      expect(options.rowCount).toBe(1);

      await tx.as(other);
      const hidden = await tx.query(
        "select id from public.events where id = $1",
        [event],
      );
      expect(hidden.rowCount).toBe(0);
    });
  });
});
