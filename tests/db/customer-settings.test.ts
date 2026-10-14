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

describe("an event's private details", () => {
  const PRIVATE =
    "select event_id, facebook_group_url, joining_info, class_kits_info from public.event_private_details($1)";

  it("are only for the team and people booked on that event", async () => {
    await inTransaction(async (tx) => {
      const mine = await tx.createEvent({ status: "published" });
      const other = await tx.createEvent({ status: "published" });
      for (const event of [mine, other]) {
        await tx.query(
          `update public.events
              set facebook_group_url = 'https://www.facebook.com/groups/private',
                  joining_info = 'Arrive from 3pm', class_kits_info = 'Two kits'
            where id = $1`,
          [event],
        );
      }
      const booked = await tx.createUser();
      const browsing = await tx.createUser();
      const customer = await tx.createCustomer(
        "Jo Booked",
        booked.email,
        booked.id,
      );
      await tx.createBooking(mine, customer);
      const staff = [
        await tx.createStaff("door"),
        await tx.createStaff("admin"),
        await tx.createStaff("owner"),
      ];

      // Signed-in accounts can't read the columns themselves at all.
      for (const user of [browsing, booked, ...staff]) {
        await tx.as(user);
        for (const column of [
          "facebook_group_url",
          "joining_info",
          "class_kits_info",
        ]) {
          expect(
            await tx.expectError(
              `select ${column} from public.events where id = $1`,
              [mine],
            ),
          ).toMatch(/permission denied/);
        }
        // Everything else about a published event still reads as before.
        const { rows } = await tx.query(
          "select title, status from public.events where id = $1",
          [mine],
        );
        expect(rows).toHaveLength(1);
      }

      await tx.as(browsing);
      expect((await tx.query(PRIVATE, [[mine, other]])).rowCount).toBe(0);

      await tx.as(booked);
      const own = await tx.query(PRIVATE, [[mine, other]]);
      expect(own.rows).toEqual([
        {
          event_id: mine,
          facebook_group_url: "https://www.facebook.com/groups/private",
          joining_info: "Arrive from 3pm",
          class_kits_info: "Two kits",
        },
      ]);

      for (const user of staff) {
        await tx.as(user);
        const seen = await tx.query(PRIVATE, [[mine, other]]);
        expect(seen.rowCount).toBe(2);
      }

      // Once their booking is cancelled, they don't get them any more.
      await tx.asSuperuser();
      await tx.query(
        "update public.bookings set cancelled_at = now() where customer_id = $1",
        [customer],
      );
      await tx.as(booked);
      expect((await tx.query(PRIVATE, [[mine]])).rowCount).toBe(0);

      await tx.asAnonymous();
      expect(await tx.expectError(PRIVATE, [[mine]])).toMatch(
        /permission denied/,
      );
    });
  });
});
