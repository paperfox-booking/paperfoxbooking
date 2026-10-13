import { sql, uniqueSuffix } from "./team";

/**
 * Made-up events and people for browser tests, added straight into the local
 * database. Each call makes its own, so tests can run side by side.
 */

export async function eventWithPeople() {
  const suffix = uniqueSuffix();
  const [event] = await sql<{ id: string }>(
    `insert into public.events (title, venue_id, starts_at, ends_at, balance_due_on, capacity)
     select $1, id, '2031-03-14T09:00:00Z', '2031-03-16T17:00:00Z', '2031-01-31', 110
     from public.venues where name = 'Holiday Inn Coventry'
     returning id`,
    [`People Test ${suffix}`],
  );
  const eventId = event!.id;
  const [weekend] = await sql<{ id: string }>(
    `insert into public.ticket_types (event_id, name, price_pence, deposit_pence, sort_order)
     values ($1, 'Weekend (4pm start)', 19500, 6000, 1) returning id`,
    [eventId],
  );
  await sql(
    `insert into public.ticket_types (event_id, name, price_pence, deposit_pence, sort_order)
     values ($1, 'Friday Kick Starter (9am start)', 24500, 8500, 2)`,
    [eventId],
  );
  const [room] = await sql<{ id: string }>(
    `insert into public.event_rooms (event_id, name, capacity) values ($1, 'Main room', 78) returning id`,
    [eventId],
  );
  const people = {
    team: `Aaron Helper ${suffix}`,
    zoe: `Zoe Crafter ${suffix}`,
    bea: `Bea Scrapper ${suffix}`,
  };
  for (const [name, isTeam, price] of [
    [people.zoe, false, 19500],
    [people.team, true, 0],
    [people.bea, false, 19500],
  ] as const) {
    const [customer] = await sql<{ id: string }>(
      `insert into public.customers (full_name, email, is_team) values ($1, $2, $3) returning id`,
      [name, `${name.replace(/\s+/g, ".").toLowerCase()}@example.test`, isTeam],
    );
    await sql(
      `insert into public.bookings (event_id, customer_id, ticket_type_id, room_id, price_pence, deposit_pence)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        eventId,
        customer!.id,
        price ? weekend!.id : null,
        room!.id,
        price,
        price ? 6000 : null,
      ],
    );
  }
  return { eventId, people };
}
