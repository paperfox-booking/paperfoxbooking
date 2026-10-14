import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool, type TestTransaction } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("booking references", () => {
  it("number each year's bookings in order, like PF-2027-0001", async () => {
    await inTransaction(async (tx) => {
      // Start from a year no other test uses.
      const event = await tx.createEvent({
        startsAt: "2041-03-15T09:00:00Z",
        endsAt: "2041-03-17T17:00:00Z",
        balanceDueOn: "2041-02-01",
      });
      const first = await tx.createBooking(event, await tx.createCustomer());
      const second = await tx.createBooking(event, await tx.createCustomer());
      expect(first.reference).toBe("PF-2041-0001");
      expect(second.reference).toBe("PF-2041-0002");
    });
  });

  it("don't leave a gap when a booking fails", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({
        startsAt: "2042-03-14T09:00:00Z",
        endsAt: "2042-03-16T17:00:00Z",
        balanceDueOn: "2042-02-01",
        capacity: 1,
      });
      await tx.createBooking(event, await tx.createCustomer());
      // The event is full, so this fails, and its number is given back.
      const customer = await tx.createCustomer();
      expect(
        await tx.expectError(
          "insert into public.bookings (event_id, customer_id, price_pence) values ($1, $2, 0)",
          [event, customer],
        ),
      ).toMatch(/This event is full/);
      await tx.query("update public.events set capacity = 2 where id = $1", [
        event,
      ]);
      const next = await tx.createBooking(event, customer);
      expect(next.reference).toBe("PF-2042-0002");
    });
  });
});

describe("places", () => {
  it("never lets an event have more bookings than places", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent({ capacity: 2 });
      await tx.createBooking(event, await tx.createCustomer());
      const cancelled = await tx.createBooking(
        event,
        await tx.createCustomer(),
      );
      const third = await tx.createCustomer();
      expect(
        await tx.expectError(
          "insert into public.bookings (event_id, customer_id, price_pence) values ($1, $2, 0)",
          [event, third],
        ),
      ).toMatch(/This event is full \(2 places\)/);

      // Cancelling frees a place; un-cancelling needs one free.
      await tx.query(
        "update public.bookings set cancelled_at = now() where id = $1",
        [cancelled.id],
      );
      await tx.createBooking(event, third);
      expect(
        await tx.expectError(
          "update public.bookings set cancelled_at = null where id = $1",
          [cancelled.id],
        ),
      ).toMatch(/This event is full/);
    });
  });

  it("respects an option's own limit", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const option = await tx.createTicketType(event, { name: "Small class" });
      await tx.query(
        "update public.ticket_types set capacity = 1 where id = $1",
        [option],
      );
      const insert =
        "insert into public.bookings (event_id, customer_id, ticket_type_id, price_pence) values ($1, $2, $3, 0)";
      await tx.query(insert, [event, await tx.createCustomer(), option]);
      expect(
        await tx.expectError(insert, [
          event,
          await tx.createCustomer(),
          option,
        ]),
      ).toMatch(/That option is full \(1 places\)/);
    });
  });

  it("gives the last place to exactly one of two people booking at the same moment", async () => {
    const setup = await pool.connect();
    const eventId = randomUUID();
    const customers = [randomUUID(), randomUUID()];
    try {
      const venue = await setup.query<{ id: string }>(
        "insert into public.venues (name) values ('Race venue') returning id",
      );
      await setup.query(
        `insert into public.events (id, title, venue_id, starts_at, ends_at, balance_due_on, capacity)
         values ($1, 'Race test', $2, '2043-03-13T09:00:00Z', '2043-03-15T17:00:00Z', '2043-02-01', 1)`,
        [eventId, venue.rows[0]!.id],
      );
      for (const id of customers) {
        await setup.query(
          "insert into public.customers (id, full_name) values ($1, 'Racer')",
          [id],
        );
      }

      const [first, second] = [await pool.connect(), await pool.connect()];
      try {
        await first.query("begin");
        await second.query("begin");
        const insert =
          "insert into public.bookings (event_id, customer_id, price_pence) values ($1, $2, 0)";
        await first.query(insert, [eventId, customers[0]]);
        // The second waits for the first to finish, then finds no place left.
        const secondAttempt = second
          .query(insert, [eventId, customers[1]])
          .then(() => "booked")
          .catch((error: Error) => error.message);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await first.query("commit");
        expect(await secondAttempt).toMatch(/This event is full/);
        await second.query("rollback");
      } finally {
        first.release();
        second.release();
      }

      const { rows } = await setup.query(
        "select count(*)::int as booked from public.bookings where event_id = $1",
        [eventId],
      );
      expect(rows[0]?.booked).toBe(1);
    } finally {
      await setup.query("delete from public.bookings where event_id = $1", [
        eventId,
      ]);
      await setup.query("delete from public.customers where id = any($1)", [
        customers,
      ]);
      await setup.query("delete from public.events where id = $1", [eventId]);
      setup.release();
    }
  });

  it("only gives someone one place on each event", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const customer = await tx.createCustomer();
      await tx.createBooking(event, customer);
      expect(
        await tx.expectError(
          "insert into public.bookings (event_id, customer_id, price_pence) values ($1, $2, 0)",
          [event, customer],
        ),
      ).toMatch(/bookings_one_place_per_person/);
    });
  });

  it("only allows options and rooms from the same event", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const otherEvent = await tx.createEvent();
      const otherOption = await tx.createTicketType(otherEvent);
      expect(
        await tx.expectError(
          "insert into public.bookings (event_id, customer_id, ticket_type_id, price_pence) values ($1, $2, $3, 0)",
          [event, await tx.createCustomer(), otherOption],
        ),
      ).toMatch(/bookings_option_same_event/);
    });
  });
});

describe("who can see bookings and payments", () => {
  async function bookedCustomer(tx: TestTransaction, event: string) {
    const user = await tx.createUser("Customer");
    const customer = await tx.createCustomer("Customer", user.email, user.id);
    const booking = await tx.createBooking(event, customer);
    await tx.createPayment(booking.id, 6000);
    return { user, customer, booking };
  }

  it("shows a customer only their own details, bookings and payments", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const a = await bookedCustomer(tx, event);
      const b = await bookedCustomer(tx, event);

      await tx.as(a.user);
      for (const [table, column] of [
        ["customers", "id"],
        ["bookings", "customer_id"],
      ] as const) {
        const { rows } = await tx.query<{ id: string }>(
          `select ${column} as id from public.${table} where ${column} = any($1)`,
          [[a.customer, b.customer]],
        );
        expect(
          rows.map((row) => row.id),
          table,
        ).toEqual([a.customer]);
      }
      const payments = await tx.query<{ booking_id: string }>(
        "select booking_id from public.payments where booking_id = any($1)",
        [[a.booking.id, b.booking.id]],
      );
      expect(payments.rows.map((row) => row.booking_id)).toEqual([
        a.booking.id,
      ]);
    });
  });

  it("doesn't let customers change bookings or record payments", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const a = await bookedCustomer(tx, event);
      await tx.as(a.user);
      const update = await tx.query(
        "update public.bookings set price_pence = 0 where id = $1",
        [a.booking.id],
      );
      expect(update.rowCount).toBe(0);
      expect(
        await tx.expectError(
          "insert into public.payments (booking_id, amount_pence, received_on) values ($1, 13500, '2026-10-01')",
          [a.booking.id],
        ),
      ).toMatch(/row-level security/);
      const audit = await tx.query("select 1 from public.audit_log");
      expect(audit.rowCount).toBe(0);
    });
  });

  it("links someone's record when they sign in with the same email", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const email = `${randomUUID().slice(0, 8)}@example.test`;
      const customer = await tx.createCustomer("Imported person", email);
      await tx.createBooking(event, customer);

      const user = await tx.createUser("Imported person");
      await tx.query("update auth.users set email = $2 where id = $1", [
        user.id,
        email.toUpperCase(),
      ]);
      // Not linked until the email address is confirmed (by signing in).
      const before = await tx.query(
        "select user_id from public.customers where id = $1",
        [customer],
      );
      expect(before.rows[0]?.user_id).toBeNull();
      await tx.query(
        "update auth.users set email_confirmed_at = now() where id = $1",
        [user.id],
      );
      await tx.as({ id: user.id, email });
      const { rows } = await tx.query(
        "select customer_id from public.bookings where event_id = $1",
        [event],
      );
      expect(rows).toEqual([{ customer_id: customer }]);
    });
  });

  it("links a person the team adds to an account with the same confirmed email", async () => {
    await inTransaction(async (tx) => {
      const user = await tx.createUser("Signed up first");
      await tx.query(
        "update auth.users set email_confirmed_at = now() where id = $1",
        [user.id],
      );
      const unconfirmed = await tx.createUser("Not confirmed");
      await tx.as(await tx.createStaff("admin"));
      const { rows } = await tx.query<{ user_id: string | null }>(
        "insert into public.customers (full_name, email) values ('Signed up first', $1), ('Not confirmed', $2) returning user_id",
        [user.email, unconfirmed.email],
      );
      expect(rows.map((row) => row.user_id)).toEqual([user.id, null]);
    });
  });

  it("lets door staff see bookings and people, but not payments, emails or the audit log", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const a = await bookedCustomer(tx, event);
      const door = await tx.createStaff("door");
      await tx.as(door);

      const bookings = await tx.query(
        "select id from public.bookings where id = $1",
        [a.booking.id],
      );
      expect(bookings.rowCount).toBe(1);
      const people = await tx.query(
        "select dietary_health from public.customers where id = $1",
        [a.customer],
      );
      expect(people.rows).toEqual([{ dietary_health: "Gluten free" }]);
      for (const table of ["payments", "email_log", "audit_log"]) {
        const { rowCount } = await tx.query(`select 1 from public.${table}`);
        expect(rowCount, table).toBe(0);
      }
      const change = await tx.query(
        "update public.bookings set notes = 'x' where id = $1",
        [a.booking.id],
      );
      expect(change.rowCount).toBe(0);
    });
  });
});

describe("payments", () => {
  it("can be recorded and removed with a reason, but never edited", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      const { rows } = await tx.query<{ id: string; recorded_by: string }>(
        `insert into public.payments (booking_id, amount_pence, method, received_on, note)
         values ($1, 6000, 'bank_transfer', '2026-10-01', 'Deposit') returning id, recorded_by`,
        [booking.id],
      );
      const payment = rows[0]!;
      expect(payment.recorded_by).toBe(admin.id);

      expect(
        await tx.expectError(
          "update public.payments set amount_pence = 1 where id = $1",
          [payment.id],
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError(
          "update public.payments set deleted_at = now() where id = $1",
          [payment.id],
        ),
      ).toMatch(/payments_delete_reason/);
      const removed = await tx.query(
        "update public.payments set deleted_at = now(), delete_reason = 'Recorded twice' where id = $1",
        [payment.id],
      );
      expect(removed.rowCount).toBe(1);
    });
  });

  it("are whole pence and more than nothing", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const insert =
        "insert into public.payments (booking_id, amount_pence, received_on) values ($1, $2, '2026-10-01')";
      expect(await tx.expectError(insert, [booking.id, 0])).toMatch(
        /payments_amount_range/,
      );
      expect(await tx.expectError(insert, [booking.id, 60.5])).toMatch(
        /invalid input syntax for type integer/,
      );
    });
  });

  it("are recorded in the audit log, with who did it", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(event, await tx.createCustomer());
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.payments (booking_id, amount_pence, received_on) values ($1, 13500, '2026-12-01') returning id",
        [booking.id],
      );
      const audit = await tx.query(
        `select action, changed_by, new_values ->> 'amount_pence' as amount
           from public.audit_log where table_name = 'payments' and record_id = $1`,
        [rows[0]!.id],
      );
      expect(audit.rows).toEqual([
        { action: "insert", changed_by: owner.id, amount: "13500" },
      ]);
      expect(await tx.expectError("delete from public.audit_log")).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("importing a spreadsheet", () => {
  async function eventWithOptions(tx: TestTransaction) {
    const event = await tx.createEvent();
    const weekend = await tx.createTicketType(event, {
      name: "Weekend (4pm start)",
      pricePence: 19500,
      depositPence: 6000,
    });
    const kickStarter = await tx.createTicketType(event, {
      name: "Friday Kick Starter (9am start)",
      pricePence: 24500,
      depositPence: 8500,
    });
    return { event, weekend, kickStarter };
  }

  it("brings in people, rooms, bookings, payments and emails sent", async () => {
    await inTransaction(async (tx) => {
      const { event, weekend, kickStarter } = await eventWithOptions(tx);
      const returning = `${randomUUID().slice(0, 8)}@example.test`;
      const existing = await tx.createCustomer("Returning Person", returning);
      const owner = await tx.createStaff("owner");
      await tx.as(owner);

      const people = [
        {
          full_name: "Team Member",
          is_team: true,
          price_pence: 0,
          room_name: "Main room",
        },
        {
          full_name: "Returning Person",
          email: returning.toUpperCase(),
          phone: "07700 900001",
          ticket_type_id: kickStarter,
          room_name: "2nd Room A",
          price_pence: 24500,
          received_pence: 8500,
          email_template: "B2",
          email_sent_on: "2026-03-22",
        },
        {
          full_name: "New Person",
          email: "new.person@example.test",
          ticket_type_id: weekend,
          room_name: "Main room",
          price_pence: 19500,
          received_pence: 19500,
          notes: "Sit with Returning Person",
        },
      ];
      const { rows } = await tx.query(
        "select public.import_bookings($1, $2, $3) as imported",
        [
          event,
          JSON.stringify([{ name: "Main room", capacity: 78 }]),
          JSON.stringify(people),
        ],
      );
      expect(rows[0]?.imported).toBe(3);

      const bookings = await tx.query(
        `select c.full_name, c.email, c.phone, c.is_team, b.price_pence, b.deposit_pence,
                b.source, r.name as room, b.notes,
                (select sum(p.amount_pence)::int from public.payments p where p.booking_id = b.id) as paid,
                (select string_agg(l.template || ' ' || l.sent_on, ',') from public.email_log l where l.booking_id = b.id) as emails
           from public.bookings b
           join public.customers c on c.id = b.customer_id
           left join public.event_rooms r on r.id = b.room_id
          where b.event_id = $1
          order by b.reference`,
        [event],
      );
      expect(bookings.rows).toEqual([
        {
          full_name: "Team Member",
          email: null,
          phone: "",
          is_team: true,
          price_pence: 0,
          deposit_pence: null,
          source: "import",
          room: "Main room",
          notes: "",
          paid: null,
          emails: null,
        },
        {
          full_name: "Returning Person",
          email: returning,
          phone: "07700 900001",
          is_team: false,
          price_pence: 24500,
          deposit_pence: 8500,
          source: "import",
          room: "2nd Room A",
          notes: "",
          paid: 8500,
          emails: "B2 2026-03-22",
        },
        {
          full_name: "New Person",
          email: "new.person@example.test",
          phone: "",
          is_team: false,
          price_pence: 19500,
          deposit_pence: 6000,
          source: "import",
          room: "Main room",
          notes: "Sit with Returning Person",
          paid: 19500,
          emails: null,
        },
      ]);

      // The returning person's existing record was used, not duplicated.
      const matches = await tx.query(
        "select id from public.customers where email = $1",
        [returning],
      );
      expect(matches.rows).toEqual([{ id: existing }]);

      const rooms = await tx.query(
        "select name, capacity from public.event_rooms where event_id = $1 order by sort_order",
        [event],
      );
      expect(rooms.rows).toEqual([
        { name: "Main room", capacity: 78 },
        { name: "2nd Room A", capacity: null },
      ]);
    });
  });

  it("only imports into an event with nobody booked yet", async () => {
    await inTransaction(async (tx) => {
      const { event } = await eventWithOptions(tx);
      await tx.createBooking(event, await tx.createCustomer());
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      expect(
        await tx.expectError("select public.import_bookings($1, '[]', $2)", [
          event,
          JSON.stringify([{ full_name: "Someone", price_pence: 0 }]),
        ]),
      ).toMatch(/already has people booked/);
    });
  });

  it("saves nothing if any row is wrong", async () => {
    await inTransaction(async (tx) => {
      const { event } = await eventWithOptions(tx);
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      expect(
        await tx.expectError("select public.import_bookings($1, '[]', $2)", [
          event,
          JSON.stringify([
            { full_name: "Fine", price_pence: 19500 },
            { full_name: "Broken", price_pence: -5 },
          ]),
        ]),
      ).toMatch(/bookings_price_range/);
      await tx.asSuperuser();
      const { rowCount } = await tx.query(
        "select 1 from public.bookings where event_id = $1",
        [event],
      );
      expect(rowCount).toBe(0);
    });
  });

  it("is only allowed for owners and admins", async () => {
    await inTransaction(async (tx) => {
      const { event } = await eventWithOptions(tx);
      const door = await tx.createStaff("door");
      await tx.as(door);
      expect(
        await tx.expectError("select public.import_bookings($1, '[]', '[]')", [
          event,
        ]),
      ).toMatch(/Only owners and admins can import bookings/);
    });
  });
});

describe("copying an event with rooms", () => {
  it("copies the rooms but not the bookings", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      await tx.query(
        "insert into public.event_rooms (event_id, name, capacity) values ($1, 'Main room', 78), ($1, 'Welsh', 10)",
        [event],
      );
      await tx.createBooking(event, await tx.createCustomer());
      const admin = await tx.createStaff("admin");
      await tx.as(admin);
      const { rows } = await tx.query<{ id: string }>(
        "select public.copy_event($1, 'Next one', '2028-03-17') as id",
        [event],
      );
      const copy = rows[0]!.id;
      const rooms = await tx.query(
        "select name, capacity from public.event_rooms where event_id = $1 order by name",
        [copy],
      );
      expect(rooms.rows).toEqual([
        { name: "Main room", capacity: 78 },
        { name: "Welsh", capacity: 10 },
      ]);
      const bookings = await tx.query(
        "select 1 from public.bookings where event_id = $1",
        [copy],
      );
      expect(bookings.rowCount).toBe(0);
    });
  });
});

describe("passing a place on", () => {
  it("moves the booking and its payments to someone else, with the reason in the notes", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const first = await tx.createCustomer("Jo First");
      const second = await tx.createCustomer("Ann Second");
      const booking = await tx.createBooking(event, first);
      await tx.createPayment(booking.id, 6000);
      await tx.query(
        "update public.bookings set checked_in_at = now() where id = $1",
        [booking.id],
      );
      const admin = await tx.createStaff("admin");
      await tx.as(admin);

      await tx.query("select public.pass_place($1, $2, $3)", [
        booking.id,
        second,
        "Approved by Nichola by email",
      ]);
      const { rows } = await tx.query<{
        customer_id: string;
        reference: string;
        notes: string;
        checked_in_at: string | null;
        paid: number;
      }>(
        `select b.customer_id, b.reference, b.notes, b.checked_in_at,
                (select sum(amount_pence)::int from public.payments p where p.booking_id = b.id) as paid
           from public.bookings b where b.id = $1`,
        [booking.id],
      );
      expect(rows[0]).toMatchObject({
        customer_id: second,
        reference: booking.reference,
        checked_in_at: null,
        paid: 6000,
      });
      expect(rows[0]!.notes).toMatch(
        /^Place passed on from Jo First on \d\d\/\d\d\/\d{4}: Approved by Nichola by email$/,
      );

      const audit = await tx.query(
        `select changed_by, old_values ->> 'customer_id' as from_id, new_values ->> 'customer_id' as to_id
           from public.audit_log where table_name = 'bookings' and record_id = $1 and action = 'update'`,
        [booking.id],
      );
      expect(audit.rows).toContainEqual({
        changed_by: admin.id,
        from_id: first,
        to_id: second,
      });
    });
  });

  it("takes the new person off the event's waiting list", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const first = await tx.createCustomer("Jo First");
      const second = await tx.createCustomer("Ann Second");
      const booking = await tx.createBooking(event, first);
      await tx.query(
        "insert into public.waitlist (event_id, customer_id) values ($1, $2)",
        [event, second],
      );
      await tx.as(await tx.createStaff("admin"));
      await tx.query("select public.pass_place($1, $2, 'Approved')", [
        booking.id,
        second,
      ]);
      const { rows } = await tx.query(
        "select status, notes from public.waitlist where event_id = $1 and customer_id = $2",
        [event, second],
      );
      expect(rows).toEqual([
        {
          status: "removed",
          notes: "Given a place passed on from Jo First.",
        },
      ]);
    });
  });

  it("refuses someone already booked, a cancelled booking, and no reason", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const first = await tx.createCustomer("Jo First");
      const second = await tx.createCustomer("Ann Second");
      const booking = await tx.createBooking(event, first);
      await tx.createBooking(event, second);
      const third = await tx.createCustomer("Bea Third");
      await tx.as(await tx.createStaff("owner"));

      const pass = "select public.pass_place($1, $2, $3)";
      expect(await tx.expectError(pass, [booking.id, second, "Swap"])).toMatch(
        /Ann Second already has a place on this event/,
      );
      expect(await tx.expectError(pass, [booking.id, third, "  "])).toMatch(
        /Say why the place is being passed on/,
      );
      expect(await tx.expectError(pass, [booking.id, first, "Swap"])).toMatch(
        /They already have this place/,
      );
      await tx.query(
        "update public.bookings set cancelled_at = now(), cancel_reason = 'x' where id = $1",
        [booking.id],
      );
      expect(await tx.expectError(pass, [booking.id, third, "Swap"])).toMatch(
        /This booking is cancelled/,
      );
    });
  });

  it("is only for owners and admins", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const booking = await tx.createBooking(
        event,
        await tx.createCustomer("Jo First"),
      );
      const other = await tx.createCustomer("Ann Second");
      const door = await tx.createStaff("door");
      const user = await tx.createUser("Customer");
      for (const who of [door, user]) {
        await tx.as(who);
        expect(
          await tx.expectError("select public.pass_place($1, $2, 'Swap')", [
            booking.id,
            other,
          ]),
        ).toMatch(/Only owners and admins can pass a place on/);
      }
      await tx.asAnonymous();
      expect(
        await tx.expectError("select public.pass_place($1, $2, 'Swap')", [
          booking.id,
          other,
        ]),
      ).toMatch(/permission denied/);
    });
  });
});
