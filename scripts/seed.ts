/**
 * Fills a LOCAL database with made-up events, people, bookings, payments,
 * emails and costs, for trying the system out and for screenshots. Nobody in
 * it is real.
 *
 *   pnpm seed            adds the demo data (once)
 *   pnpm seed --reset    removes the demo data first, then adds it again
 *
 * It refuses to run against anything but a database on this computer, so it
 * can never touch the staging or production databases.
 */
import pg from "pg";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(
    `Refusing to seed ${host}: the demo data is only for a local database.`,
  );
  process.exit(1);
}

const TAG = "Demo:";
const FIRST = [
  "Alison",
  "Bev",
  "Carol",
  "Dawn",
  "Elaine",
  "Fiona",
  "Gill",
  "Helen",
  "Irene",
  "Jackie",
  "Karen",
  "Lesley",
  "Mandy",
  "Nicky",
  "Paula",
  "Rachel",
  "Sandra",
  "Tracey",
  "Una",
  "Val",
  "Wendy",
  "Yvonne",
  "Zara",
  "Amanda",
  "Brenda",
  "Claire",
  "Debbie",
  "Emma",
  "Fran",
  "Gail",
];
const LAST = [
  "Ashworth",
  "Brindley",
  "Cartwright",
  "Dunmore",
  "Ellwood",
  "Fairbairn",
  "Greenhalgh",
  "Hollins",
  "Ingleby",
  "Jessop",
  "Kershaw",
  "Lockwood",
  "Marsden",
  "Nuttall",
  "Oldroyd",
  "Pickles",
  "Quarmby",
  "Rushworth",
  "Sutcliffe",
  "Thwaite",
];
const DIETARY = [
  "",
  "",
  "",
  "Vegetarian",
  "Gluten free",
  "No nuts",
  "Vegan",
  "",
];
const NOTES = [
  "",
  "",
  "Sit with Bev",
  "Near a plug socket please",
  "",
  "First time",
];

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin");
    const existing = await client.query(
      "select id from public.events where title like $1",
      [`${TAG}%`],
    );
    if (existing.rowCount) {
      if (!process.argv.includes("--reset")) {
        console.log(
          "The demo data is already there. Run pnpm seed --reset to start again.",
        );
        await client.query("rollback");
        return;
      }
      const ids = existing.rows.map((row) => row.id as string);
      await client.query(
        "delete from public.payments where booking_id in (select id from public.bookings where event_id = any($1))",
        [ids],
      );
      await client.query(
        "delete from public.email_log where booking_id in (select id from public.bookings where event_id = any($1))",
        [ids],
      );
      await client.query(
        "delete from public.bookings where event_id = any($1)",
        [ids],
      );
      await client.query("delete from public.customers where notes = $1", [
        "Made-up demo person",
      ]);
      await client.query("delete from public.events where id = any($1)", [ids]);
    }

    const venue = await client.query<{ id: string }>(
      "select id from public.venues where name = 'Holiday Inn Coventry'",
    );
    const venueId = venue.rows[0]?.id;
    if (!venueId)
      throw new Error(
        "The Holiday Inn venue is missing: run the migrations first.",
      );

    const events = [
      {
        title: `${TAG} Crop Weekend March 2027`,
        start: "2027-03-19",
        end: "2027-03-21",
        due: "2027-01-26",
        people: 34,
        status: "sold_out",
      },
      {
        title: `${TAG} Crop Weekend June 2027`,
        start: "2027-06-18",
        end: "2027-06-20",
        due: "2027-05-07",
        people: 18,
        status: "published",
      },
    ];
    let personNumber = 0;

    for (const event of events) {
      const created = await client.query<{ id: string }>(
        `insert into public.events
           (title, summary, included, venue_id, starts_at, ends_at, balance_due_on, capacity)
         values ($1, 'A weekend of crafting, chatting and cake.',
                 E'Your own 4ft crop table\\nA welcome goody bag\\nTea and coffee throughout',
                 $2, ($3 || 'T09:00:00')::timestamp at time zone 'Europe/London',
                 ($4 || 'T17:00:00')::timestamp at time zone 'Europe/London', $5, 110)
         returning id`,
        [event.title, venueId, event.start, event.end, event.due],
      );
      const eventId = created.rows[0]!.id;
      const options = await client.query<{
        id: string;
        price_pence: number;
        deposit_pence: number;
      }>(
        `insert into public.ticket_types (event_id, name, price_pence, deposit_pence, starts_at, sort_order) values
           ($1, 'Weekend (4pm start)', 19500, 6000, ($2 || 'T16:00:00')::timestamp at time zone 'Europe/London', 1),
           ($1, 'Friday Kick Starter (9am start)', 24500, 8500, ($2 || 'T09:00:00')::timestamp at time zone 'Europe/London', 2)
         returning id, price_pence, deposit_pence`,
        [eventId, event.start],
      );
      const rooms = await client.query<{ id: string }>(
        `insert into public.event_rooms (event_id, name, capacity, sort_order) values
           ($1, 'Main room', 78, 0), ($1, '2nd Room A', 12, 1), ($1, '2nd Room B', 14, 2)
         returning id`,
        [eventId],
      );
      await client.query(
        `insert into public.event_costs (event_id, category, description, supplier, amount_pence, paid, sort_order) values
           ($1, 'venue', 'Function rooms, 3 days', 'Holiday Inn Coventry', 450000, true, 0),
           ($1, 'food', 'Lunches and Saturday dinner', 'Holiday Inn Coventry', 380000, false, 1),
           ($1, 'goody_bags', 'Goody bag contents', 'Craft wholesaler', 95000, true, 2)`,
        [eventId],
      );

      for (let index = 0; index < event.people; index += 1) {
        personNumber += 1;
        const first = FIRST[personNumber % FIRST.length]!;
        const last = LAST[(personNumber * 7) % LAST.length]!;
        const isTeam = index < 2;
        const customer = await client.query<{ id: string }>(
          `insert into public.customers (full_name, email, phone, emergency_contact, dietary_health, is_team, notes)
           values ($1, $2, $3, $4, $5, $6, 'Made-up demo person') returning id`,
          [
            `${first} ${last}`,
            `${first}.${last}.${personNumber}@example.test`.toLowerCase(),
            `07700 9${String(personNumber).padStart(5, "0")}`,
            `${FIRST[(personNumber + 3) % FIRST.length]} ${last} 07700 9${String(personNumber + 500).padStart(5, "0")}`,
            DIETARY[personNumber % DIETARY.length],
            isTeam,
          ],
        );
        const option = isTeam ? null : options.rows[index % 2]!;
        const booking = await client.query<{ id: string }>(
          `insert into public.bookings
             (event_id, customer_id, ticket_type_id, room_id, price_pence, deposit_pence, notes, source)
           values ($1, $2, $3, $4, $5, $6, $7, 'staff') returning id`,
          [
            eventId,
            customer.rows[0]!.id,
            option?.id ?? null,
            rooms.rows[index % 5 < 3 ? 0 : (index % 5) - 2]!.id,
            option?.price_pence ?? 0,
            option?.deposit_pence ?? null,
            NOTES[index % NOTES.length],
          ],
        );
        if (!option) continue;
        // A mix: nothing paid, deposit paid, part of the balance, paid in full.
        const stage = index % 4;
        const payments =
          stage === 0
            ? []
            : stage === 1
              ? [option.deposit_pence]
              : stage === 2
                ? [option.deposit_pence, 5000]
                : [
                    option.deposit_pence,
                    option.price_pence - option.deposit_pence,
                  ];
        for (const [number, amount] of payments.entries()) {
          await client.query(
            `insert into public.payments (booking_id, amount_pence, method, received_on)
             values ($1, $2, $3, $4)`,
            [
              booking.rows[0]!.id,
              amount,
              number === 1 && index % 3 === 0 ? "cash" : "bank_transfer",
              number === 0 ? "2026-04-02" : "2026-09-14",
            ],
          );
        }
        await client.query(
          `insert into public.email_log (booking_id, customer_id, template, sent_on)
           values ($1, $2, $3, '2026-04-03')`,
          [
            booking.rows[0]!.id,
            customer.rows[0]!.id,
            stage === 3 ? "B3" : stage === 0 ? "B1" : "B2",
          ],
        );
      }

      await client.query("update public.events set status = $2 where id = $1", [
        eventId,
        event.status,
      ]);
    }

    await client.query("commit");
    console.log(
      `Added ${events.length} demo events with ${personNumber} made-up people.`,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
