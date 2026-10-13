import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Helpers for testing row level security directly in Postgres.
 *
 * Each test runs inside a transaction that is always rolled back, so tests
 * never leave data behind. Inside it, `as(user)` switches to the same database
 * role and JWT claims Supabase uses for a signed-in request, so the real RLS
 * policies decide what the query can see and change.
 */

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const pool = new pg.Pool({ connectionString, max: 4 });

export type StaffRole = "owner" | "admin" | "door";

export interface TestUser {
  id: string;
  email: string;
}

export interface TestEvent {
  title: string;
  status: "draft" | "published" | "sold_out" | "cancelled" | "finished";
  startsAt: string;
  endsAt: string;
  balanceDueOn: string;
  capacity: number;
  venueId?: string;
}

export class TestTransaction {
  private savepoint = 0;

  constructor(private readonly client: pg.PoolClient) {}

  /** Runs SQL as whoever the transaction is currently acting as. */
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ) {
    return this.client.query<Row>(sql, params);
  }

  /** Creates a person the way Supabase Auth does (the profile trigger runs). */
  async createUser(name = "Test person"): Promise<TestUser> {
    const id = randomUUID();
    const email = `${id.slice(0, 8)}@example.test`;
    await this.client.query(
      `insert into auth.users (id, email, aud, role, raw_user_meta_data)
       values ($1, $2, 'authenticated', 'authenticated', $3)`,
      [id, email, JSON.stringify({ full_name: name })],
    );
    return { id, email };
  }

  /** Creates a team member with a role, bypassing RLS (setup only). */
  async createStaff(role: StaffRole, name = `Test ${role}`): Promise<TestUser> {
    const user = await this.createUser(name);
    await this.client.query(
      `insert into public.staff (user_id, role) values ($1, $2)`,
      [user.id, role],
    );
    return user;
  }

  /** Creates a venue, bypassing RLS (setup only: call as the superuser). */
  async createVenue(name = "Test venue"): Promise<string> {
    const { rows } = await this.client.query<{ id: string }>(
      "insert into public.venues (name) values ($1) returning id",
      [name],
    );
    return rows[0]!.id;
  }

  /**
   * Creates an event like the March 2027 weekend (Friday 9am to Sunday 5pm,
   * balance due 26/01/2027), bypassing RLS (setup only: call as the
   * superuser). Returns its id.
   */
  async createEvent(overrides: Partial<TestEvent> = {}): Promise<string> {
    const event: TestEvent = {
      title: "Test crop weekend",
      status: "draft",
      startsAt: "2027-03-19T09:00:00Z",
      endsAt: "2027-03-21T17:00:00Z",
      balanceDueOn: "2027-01-26",
      capacity: 110,
      ...overrides,
    };
    const venueId = event.venueId ?? (await this.createVenue());
    const { rows } = await this.client.query<{ id: string }>(
      `insert into public.events
         (title, venue_id, starts_at, ends_at, balance_due_on, capacity)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        event.title,
        venueId,
        event.startsAt,
        event.endsAt,
        event.balanceDueOn,
        event.capacity,
      ],
    );
    const id = rows[0]!.id;
    if (event.status !== "draft") {
      await this.createTicketType(id);
      await this.client.query(
        "update public.events set status = $2 where id = $1",
        [id, event.status],
      );
    }
    return id;
  }

  /** Adds an option to an event, bypassing RLS (setup only). */
  async createTicketType(
    eventId: string,
    {
      name = "Weekend (4pm start)",
      pricePence = 19500,
      depositPence = 6000 as number | null,
      startsAt = null as string | null,
    } = {},
  ): Promise<string> {
    const { rows } = await this.client.query<{ id: string }>(
      `insert into public.ticket_types
         (event_id, name, price_pence, deposit_pence, starts_at)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [eventId, name, pricePence, depositPence, startsAt],
    );
    return rows[0]!.id;
  }

  /** Adds a person to the customers list, bypassing RLS (setup only). */
  async createCustomer(
    name = "Test customer",
    email: string | null = `${randomUUID().slice(0, 8)}@example.test`,
    userId: string | null = null,
  ): Promise<string> {
    const { rows } = await this.client.query<{ id: string }>(
      `insert into public.customers (full_name, email, user_id, dietary_health)
       values ($1, $2, $3, 'Gluten free') returning id`,
      [name, email, userId],
    );
    return rows[0]!.id;
  }

  /** Books a person onto an event, bypassing RLS (setup only). */
  async createBooking(
    eventId: string,
    customerId: string,
    { pricePence = 19500, depositPence = 6000 as number | null } = {},
  ): Promise<{ id: string; reference: string }> {
    const { rows } = await this.client.query<{ id: string; reference: string }>(
      `insert into public.bookings (event_id, customer_id, price_pence, deposit_pence)
       values ($1, $2, $3, $4) returning id, reference`,
      [eventId, customerId, pricePence, depositPence],
    );
    return rows[0]!;
  }

  /** Records money received, bypassing RLS (setup only). */
  async createPayment(bookingId: string, amountPence: number): Promise<string> {
    const { rows } = await this.client.query<{ id: string }>(
      `insert into public.payments (booking_id, amount_pence, received_on)
       values ($1, $2, '2026-10-01') returning id`,
      [bookingId, amountPence],
    );
    return rows[0]!.id;
  }

  /** Acts as a signed-in person until `asSuperuser()` is called. */
  async as(user: TestUser): Promise<void> {
    await this.client.query("reset role");
    await this.client.query(
      "select set_config('request.jwt.claims', $1, true)",
      [
        JSON.stringify({
          sub: user.id,
          role: "authenticated",
          email: user.email,
        }),
      ],
    );
    await this.client.query("set local role authenticated");
  }

  /** Acts as a visitor who isn't signed in. */
  async asAnonymous(): Promise<void> {
    await this.client.query("reset role");
    await this.client.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ role: "anon" })],
    );
    await this.client.query("set local role anon");
  }

  /** Goes back to the test's own superuser connection (no RLS). */
  async asSuperuser(): Promise<void> {
    await this.client.query("reset role");
    await this.client.query(
      "select set_config('request.jwt.claims', '', true)",
    );
  }

  /**
   * Runs SQL that should fail, and returns the error message. Uses a savepoint
   * so the transaction carries on afterwards.
   */
  async expectError(sql: string, params: unknown[] = []): Promise<string> {
    const name = `expect_error_${++this.savepoint}`;
    await this.client.query(`savepoint ${name}`);
    try {
      await this.client.query(sql, params);
    } catch (error) {
      await this.client.query(`rollback to savepoint ${name}`);
      return error instanceof Error ? error.message : String(error);
    }
    await this.client.query(`release savepoint ${name}`);
    throw new Error(`Expected this to fail, but it succeeded: ${sql}`);
  }
}

/** Runs a test body in a transaction that is always rolled back. */
export async function inTransaction(
  body: (tx: TestTransaction) => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await body(new TestTransaction(client));
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}
