import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("event costs", () => {
  it("are only for owners and admins", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      await tx.query(
        "insert into public.event_costs (event_id, category, description, amount_pence) values ($1, 'venue', 'Room hire', 450000)",
        [event],
      );
      const door = await tx.createStaff("door");
      const customer = await tx.createUser();
      const admin = await tx.createStaff("admin");

      for (const person of [door, customer]) {
        await tx.as(person);
        const { rowCount } = await tx.query("select 1 from public.event_costs");
        expect(rowCount).toBe(0);
        expect(
          await tx.expectError(
            "insert into public.event_costs (event_id, amount_pence) values ($1, 100)",
            [event],
          ),
        ).toMatch(/row-level security/);
      }

      await tx.as(admin);
      const { rows } = await tx.query<{ amount_pence: number }>(
        "select amount_pence from public.event_costs where event_id = $1",
        [event],
      );
      expect(rows).toEqual([{ amount_pence: 450000 }]);
      const added = await tx.query(
        "insert into public.event_costs (event_id, category, amount_pence) values ($1, 'food', 120050)",
        [event],
      );
      expect(added.rowCount).toBe(1);
    });
  });

  it("are whole pence in a known category", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const insert =
        "insert into public.event_costs (event_id, category, amount_pence) values ($1, $2, $3)";
      expect(await tx.expectError(insert, [event, "other", -1])).toMatch(
        /event_costs_amount_range/,
      );
      expect(await tx.expectError(insert, [event, "other", 10.5])).toMatch(
        /invalid input syntax for type integer/,
      );
      expect(await tx.expectError(insert, [event, "holiday", 100])).toMatch(
        /event_costs_category/,
      );
    });
  });

  it("are copied to a new event as unpaid estimates", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      await tx.query(
        "insert into public.event_costs (event_id, category, description, amount_pence, paid) values ($1, 'venue', 'Room hire', 450000, true)",
        [event],
      );
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      const { rows } = await tx.query<{ id: string }>(
        "select public.copy_event($1, 'Next one', '2028-03-17') as id",
        [event],
      );
      const costs = await tx.query(
        "select category, description, amount_pence, paid from public.event_costs where event_id = $1",
        [rows[0]!.id],
      );
      expect(costs.rows).toEqual([
        {
          category: "venue",
          description: "Room hire",
          amount_pence: 450000,
          paid: false,
        },
      ]);
    });
  });
});
