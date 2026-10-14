import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("what visitors can see", () => {
  it("shows published events and their options, but not drafts", async () => {
    await inTransaction(async (tx) => {
      const published = await tx.createEvent({ status: "published" });
      const soldOut = await tx.createEvent({ status: "sold_out" });
      const draft = await tx.createEvent();
      await tx.createTicketType(draft);

      await tx.asAnonymous();
      const events = await tx.query<{ id: string }>(
        "select id from public.events where id = any($1)",
        [[published, soldOut, draft]],
      );
      expect(events.rows.map((row) => row.id).sort()).toEqual(
        [published, soldOut].sort(),
      );

      const options = await tx.query<{ event_id: string }>(
        "select event_id from public.ticket_types where event_id = any($1)",
        [[published, draft]],
      );
      expect(options.rows.map((row) => row.event_id)).toEqual([published]);
    });
  });

  it("doesn't show visitors an event's private Facebook group", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ status: "published" });
      await tx.query(
        "update public.events set facebook_group_url = 'https://www.facebook.com/groups/private' where id = $1",
        [event],
      );
      await tx.asAnonymous();
      expect(
        await tx.expectError(
          "select facebook_group_url from public.events where id = $1",
          [event],
        ),
      ).toMatch(/permission denied/);
      const { rows } = await tx.query(
        "select title, status from public.events where id = $1",
        [event],
      );
      expect(rows).toEqual([
        { title: "Test crop weekend", status: "published" },
      ]);
    });
  });

  it("hides deleted options and venues", async () => {
    await inTransaction(async (tx) => {
      const venue = await tx.createVenue("Old venue");
      const event = await tx.createEvent({ status: "published" });
      const removed = await tx.createTicketType(event, { name: "Removed" });
      await tx.query(
        "update public.ticket_types set deleted_at = now() where id = $1",
        [removed],
      );
      await tx.query(
        "update public.venues set deleted_at = now() where id = $1",
        [venue],
      );

      await tx.asAnonymous();
      const options = await tx.query(
        "select name from public.ticket_types where event_id = $1",
        [event],
      );
      expect(options.rows).toEqual([{ name: "Weekend (4pm start)" }]);
      const venues = await tx.query(
        "select id from public.venues where id = $1",
        [venue],
      );
      expect(venues.rowCount).toBe(0);
    });
  });

  it("doesn't let visitors or customers change anything", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ status: "published" });
      const customer = await tx.createUser();

      await tx.asAnonymous();
      expect(
        await tx.expectError("update public.events set title = 'Hacked'"),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError(
          "insert into public.venues (name) values ('Fake venue')",
        ),
      ).toMatch(/permission denied/);

      await tx.as(customer);
      const update = await tx.query(
        "update public.events set title = 'Hacked' where id = $1",
        [event],
      );
      expect(update.rowCount).toBe(0);
      const price = await tx.query(
        "update public.ticket_types set price_pence = 1 where event_id = $1",
        [event],
      );
      expect(price.rowCount).toBe(0);
      expect(
        await tx.expectError(
          "insert into public.venues (name) values ('Fake venue')",
        ),
      ).toMatch(/row-level security/);
      expect(
        await tx.expectError("delete from public.events where id = $1", [
          event,
        ]),
      ).toMatch(/permission denied/);
    });
  });
});

describe("what the team can do", () => {
  it("lets door staff see drafts but not change events", async () => {
    await inTransaction(async (tx) => {
      const draft = await tx.createEvent();
      const door = await tx.createStaff("door");

      await tx.as(door);
      const seen = await tx.query(
        "select id from public.events where id = $1",
        [draft],
      );
      expect(seen.rowCount).toBe(1);
      const update = await tx.query(
        "update public.events set title = 'Changed' where id = $1",
        [draft],
      );
      expect(update.rowCount).toBe(0);
    });
  });

  it("lets admins create an event, giving it a unique web address", async () => {
    await inTransaction(async (tx) => {
      const venue = await tx.createVenue();
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      const insert = `
        insert into public.events (title, venue_id, starts_at, ends_at, balance_due_on, capacity)
        values ($1, $2, '2027-06-18T08:00:00Z', '2027-06-20T16:00:00Z', '2027-05-07', 110)
        returning slug, status, created_by`;
      const first = await tx.query(insert, [
        "Paper Fox Escape: June 2027",
        venue,
      ]);
      const second = await tx.query(insert, [
        "Paper Fox Escape June 2027",
        venue,
      ]);

      expect(first.rows[0]).toEqual({
        slug: "paper-fox-escape-june-2027",
        status: "draft",
        created_by: admin.id,
      });
      expect(second.rows[0]?.slug).toBe("paper-fox-escape-june-2027-2");
    });
  });

  it("doesn't let anyone choose the web address or who created it", async () => {
    await inTransaction(async (tx) => {
      const venue = await tx.createVenue();
      const event = await tx.createEvent();
      const owner = await tx.createStaff("owner");
      await tx.as(owner);

      expect(
        await tx.expectError(
          `insert into public.events (title, slug, venue_id, starts_at, ends_at, balance_due_on, capacity)
           values ('Event', 'my-slug', $1, '2027-06-18T08:00:00Z', '2027-06-20T16:00:00Z', '2027-05-07', 10)`,
          [venue],
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError(
          "update public.events set slug = 'new-address' where id = $1",
          [event],
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError(
          "update public.events set created_by = $2 where id = $1",
          [event, owner.id],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("only publishes an event once it has an option on sale", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      expect(
        await tx.expectError(
          "update public.events set status = 'published' where id = $1",
          [event],
        ),
      ).toMatch(/Add at least one option that's on sale/);

      await tx.query(
        `insert into public.ticket_types (event_id, name, price_pence, deposit_pence)
         values ($1, 'Weekend (4pm start)', 19500, 6000)`,
        [event],
      );
      const publish = await tx.query(
        "update public.events set status = 'published' where id = $1",
        [event],
      );
      expect(publish.rowCount).toBe(1);
    });
  });

  it("never reopens a cancelled event", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ status: "cancelled" });
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      expect(
        await tx.expectError(
          "update public.events set status = 'published' where id = $1",
          [event],
        ),
      ).toMatch(/can't be reopened/);
    });
  });

  it("only deletes drafts", async () => {
    await inTransaction(async (tx) => {
      const draft = await tx.createEvent();
      const published = await tx.createEvent({ status: "published" });
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      const removed = await tx.query(
        "update public.events set deleted_at = now() where id = $1",
        [draft],
      );
      expect(removed.rowCount).toBe(1);
      expect(
        await tx.expectError(
          "update public.events set deleted_at = now() where id = $1",
          [published],
        ),
      ).toMatch(/Only draft events can be deleted/);
    });
  });
});

describe("money and dates are stored safely", () => {
  it("keeps the deposit below the full price", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const insert =
        "insert into public.ticket_types (event_id, name, price_pence, deposit_pence) values ($1, 'Option', $2, $3)";
      expect(await tx.expectError(insert, [event, 19500, 19500])).toMatch(
        /ticket_types_deposit_below_price/,
      );
      expect(await tx.expectError(insert, [event, 19500, 0])).toMatch(
        /ticket_types_deposit_below_price/,
      );
      expect(await tx.expectError(insert, [event, -100, null])).toMatch(
        /ticket_types_price_range/,
      );
      expect(await tx.expectError(insert, [event, 195.5, null])).toMatch(
        /invalid input syntax for type integer/,
      );
      await tx.query(insert, [event, 24500, 8500]);
      await tx.query(insert, [event, 0, null]);
    });
  });

  it("needs the balance due date to be before the event starts in UK time", async () => {
    await inTransaction(async (tx) => {
      // Starts at 00:30 UK time on 1 July (23:30 UTC on 30 June).
      const event = await tx.createEvent({
        startsAt: "2027-06-30T23:30:00Z",
        endsAt: "2027-07-02T16:00:00Z",
        balanceDueOn: "2027-05-20",
      });
      const update =
        "update public.events set balance_due_on = $2 where id = $1";
      expect(await tx.expectError(update, [event, "2027-07-01"])).toMatch(
        /events_balance_due_before_start/,
      );
      const ok = await tx.query(update, [event, "2027-06-30"]);
      expect(ok.rowCount).toBe(1);
    });
  });

  it("needs an event to end after it starts", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      expect(
        await tx.expectError(
          "update public.events set ends_at = starts_at where id = $1",
          [event],
        ),
      ).toMatch(/events_ends_after_start/);
    });
  });
});

/**
 * The March 2027 weekend (in GMT) with its two options, each with its own
 * start, and a removed option.
 */
async function marchEvent(
  tx: Parameters<Parameters<typeof inTransaction>[0]>[0],
) {
  const event = await tx.createEvent({
    title: "Coventry Crop Weekend March 2027",
    startsAt: "2027-03-19T09:00:00Z",
    endsAt: "2027-03-21T17:00:00Z",
    balanceDueOn: "2027-01-26",
  });
  await tx.query(
    `update public.events
        set summary = 'Our spring crop', included = 'Goody bag',
            facebook_group_url = 'https://www.facebook.com/groups/march2027',
            booking_opens_at = '2026-03-23T09:00:00Z', deposit_hold_days = 5,
            joining_info = 'Arrive from 3pm', class_kits_info = 'Two kits'
      where id = $1`,
    [event],
  );
  await tx.createTicketType(event, {
    name: "Weekend (4pm start)",
    pricePence: 19500,
    depositPence: 6000,
    startsAt: "2027-03-19T16:00:00Z",
  });
  const kickStarter = await tx.createTicketType(event, {
    name: "Friday Kick Starter (9am start)",
    pricePence: 24500,
    depositPence: 8500,
    startsAt: "2027-03-19T09:00:00Z",
  });
  const removed = await tx.createTicketType(event, { name: "Old option" });
  await tx.query(
    "update public.ticket_types set deleted_at = now(), sort_order = 1 where id = $1",
    [removed],
  );
  await tx.query(
    "update public.ticket_types set sort_order = 2 where id = $1",
    [kickStarter],
  );
  return event;
}

describe("copying an event", () => {
  it("moves every date on, keeping UK clock times across the clocks changing", async () => {
    await inTransaction(async (tx) => {
      const march = await marchEvent(tx);
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      // March is in GMT; June is in British Summer Time, an hour ahead.
      const { rows } = await tx.query<{ id: string }>(
        "select public.copy_event($1, 'Coventry Crop Weekend June 2027', '2027-06-18') as id",
        [march],
      );
      const copy = rows[0]!.id;

      // The private columns can only be read through
      // event_private_details, so check the copy as the database itself.
      await tx.asSuperuser();
      const event = await tx.query(
        `select title, slug, status, starts_at, ends_at, balance_due_on::text,
                booking_opens_at, deposit_hold_days, summary, included,
                facebook_group_url, copied_from_event_id, created_by,
                joining_info, class_kits_info
           from public.events where id = $1`,
        [copy],
      );
      expect(event.rows[0]).toEqual({
        title: "Coventry Crop Weekend June 2027",
        slug: "coventry-crop-weekend-june-2027",
        status: "draft",
        starts_at: new Date("2027-06-18T08:00:00Z"),
        ends_at: new Date("2027-06-20T16:00:00Z"),
        balance_due_on: "2027-04-27",
        booking_opens_at: new Date("2026-06-22T08:00:00Z"),
        deposit_hold_days: 5,
        summary: "Our spring crop",
        included: "Goody bag",
        // Each event has its own Facebook group, so it isn't copied.
        facebook_group_url: null,
        copied_from_event_id: march,
        created_by: admin.id,
        // Each event's joining details and class kits are its own, so last
        // time's dates can't go out by mistake.
        joining_info: "",
        class_kits_info: "",
      });

      const options = await tx.query(
        `select name, price_pence, deposit_pence, starts_at, sort_order
           from public.ticket_types where event_id = $1 order by sort_order`,
        [copy],
      );
      expect(options.rows).toEqual([
        {
          name: "Weekend (4pm start)",
          price_pence: 19500,
          deposit_pence: 6000,
          starts_at: new Date("2027-06-18T15:00:00Z"),
          sort_order: 0,
        },
        {
          name: "Friday Kick Starter (9am start)",
          price_pence: 24500,
          deposit_pence: 8500,
          starts_at: new Date("2027-06-18T08:00:00Z"),
          sort_order: 2,
        },
      ]);
    });
  });

  it("copies last year's event to the same weekend a year on", async () => {
    await inTransaction(async (tx) => {
      const march = await marchEvent(tx);
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      const { rows } = await tx.query<{ id: string }>(
        "select public.copy_event($1, 'Coventry Crop Weekend March 2028', '2028-03-17') as id",
        [march],
      );
      const copy = await tx.query(
        "select starts_at, ends_at, balance_due_on::text from public.events where id = $1",
        [rows[0]!.id],
      );
      expect(copy.rows[0]).toEqual({
        starts_at: new Date("2028-03-17T09:00:00Z"),
        ends_at: new Date("2028-03-19T17:00:00Z"),
        balance_due_on: "2028-01-25",
      });
    });
  });

  it("is only allowed for owners and admins", async () => {
    await inTransaction(async (tx) => {
      const march = await marchEvent(tx);
      const door = await tx.createStaff("door");
      const customer = await tx.createUser();
      const copy = "select public.copy_event($1, 'Copy', '2027-06-18')";

      await tx.as(door);
      expect(await tx.expectError(copy, [march])).toMatch(
        /Only owners and admins can copy events/,
      );
      await tx.as(customer);
      expect(await tx.expectError(copy, [march])).toMatch(
        /Only owners and admins can copy events/,
      );
      await tx.asAnonymous();
      expect(await tx.expectError(copy, [march])).toMatch(/permission denied/);
    });
  });
});

describe("moving an event to new dates", () => {
  async function optionStarts(
    tx: Parameters<Parameters<typeof inTransaction>[0]>[0],
    event: string,
  ) {
    await tx.asSuperuser();
    const { rows } = await tx.query<{ name: string; starts_at: Date | null }>(
      `select name, starts_at from public.ticket_types
        where event_id = $1 order by name`,
      [event],
    );
    return Object.fromEntries(rows.map((row) => [row.name, row.starts_at]));
  }

  it("moves each option's start by the same days, keeping UK clock times across the clocks changing", async () => {
    await inTransaction(async (tx) => {
      const march = await marchEvent(tx);
      await tx.createTicketType(march, { name: "Starts with the event" });
      // A removed option is left as it was.
      await tx.query(
        `update public.ticket_types set starts_at = '2027-03-19T10:00:00Z'
          where event_id = $1 and name = 'Old option'`,
        [march],
      );
      const admin = await tx.createStaff("admin");

      // March is in GMT; June is in British Summer Time, an hour ahead. The
      // start stays 9am in UK time, as the event form sends it.
      await tx.as(admin);
      await tx.query(
        `update public.events
            set starts_at = '2027-06-18T08:00:00Z', ends_at = '2027-06-20T16:00:00Z'
          where id = $1`,
        [march],
      );
      expect(await optionStarts(tx, march)).toEqual({
        "Weekend (4pm start)": new Date("2027-06-18T15:00:00Z"),
        "Friday Kick Starter (9am start)": new Date("2027-06-18T08:00:00Z"),
        "Starts with the event": null,
        "Old option": new Date("2027-03-19T10:00:00Z"),
      });

      // And back again, a week earlier than before.
      await tx.as(admin);
      await tx.query(
        `update public.events
            set starts_at = '2027-03-12T09:00:00Z', ends_at = '2027-03-14T17:00:00Z'
          where id = $1`,
        [march],
      );
      expect(await optionStarts(tx, march)).toEqual({
        "Weekend (4pm start)": new Date("2027-03-12T16:00:00Z"),
        "Friday Kick Starter (9am start)": new Date("2027-03-12T09:00:00Z"),
        "Starts with the event": null,
        "Old option": new Date("2027-03-19T10:00:00Z"),
      });

      // Each move is in the history, under the person who made it.
      const history = await tx.query<{ changed_by: string }>(
        `select changed_by from public.audit_log
          where table_name = 'ticket_types' and action = 'update'
            and record_id in (select id from public.ticket_types where event_id = $1)
            and changed_by = $2`,
        [march, admin.id],
      );
      expect(history.rows).toHaveLength(4);
    });
  });

  it("leaves the options alone when only the time changes", async () => {
    await inTransaction(async (tx) => {
      const march = await marchEvent(tx);
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      await tx.query(
        "update public.events set starts_at = '2027-03-19T10:30:00Z', title = 'Renamed' where id = $1",
        [march],
      );
      const starts = await optionStarts(tx, march);
      expect(starts["Weekend (4pm start)"]).toEqual(
        new Date("2027-03-19T16:00:00Z"),
      );
      expect(starts["Friday Kick Starter (9am start)"]).toEqual(
        new Date("2027-03-19T09:00:00Z"),
      );
    });
  });

  it("goes by the UK date, not the UTC date", async () => {
    await inTransaction(async (tx) => {
      // Both starts are on 17 June in UTC, but the second is half past
      // midnight on Friday 18 June in UK time, so the options move a day.
      const june = await tx.createEvent({
        startsAt: "2027-06-17T22:30:00Z",
        endsAt: "2027-06-20T16:00:00Z",
        balanceDueOn: "2027-05-07",
      });
      await tx.createTicketType(june, {
        name: "Weekend (4pm start)",
        startsAt: "2027-06-18T15:00:00Z",
      });
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      await tx.query(
        "update public.events set starts_at = '2027-06-17T23:30:00Z' where id = $1",
        [june],
      );
      expect(await optionStarts(tx, june)).toEqual({
        "Weekend (4pm start)": new Date("2027-06-19T15:00:00Z"),
      });
    });
  });
});
