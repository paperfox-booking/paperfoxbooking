import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("profiles", () => {
  it("are created automatically when someone signs up", async () => {
    await inTransaction(async (tx) => {
      const person = await tx.createUser("Jo Smith");
      const { rows } = await tx.query(
        "select email, full_name, marketing_consent from public.profiles where id = $1",
        [person.id],
      );
      expect(rows).toEqual([
        {
          email: person.email,
          full_name: "Jo Smith",
          marketing_consent: false,
        },
      ]);
    });
  });

  it("follow email changes made through sign-in", async () => {
    await inTransaction(async (tx) => {
      const person = await tx.createUser();
      await tx.query(
        "update auth.users set email = 'new@example.test' where id = $1",
        [person.id],
      );
      const { rows } = await tx.query(
        "select email from public.profiles where id = $1",
        [person.id],
      );
      expect(rows[0]?.email).toBe("new@example.test");
    });
  });
});

describe("customer A can't read or change customer B's details", () => {
  it("only shows a customer their own profile", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser("Customer A");
      const b = await tx.createUser("Customer B");

      await tx.as(a);
      const { rows } = await tx.query("select id from public.profiles");
      expect(rows.map((row) => row.id)).toEqual([a.id]);

      const direct = await tx.query(
        "select id from public.profiles where id = $1",
        [b.id],
      );
      expect(direct.rowCount).toBe(0);
    });
  });

  it("doesn't let a customer change someone else's profile", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser("Customer A");
      const b = await tx.createUser("Customer B");

      await tx.as(a);
      const result = await tx.query(
        "update public.profiles set full_name = 'Hacked' where id = $1",
        [b.id],
      );
      expect(result.rowCount).toBe(0);

      await tx.asSuperuser();
      const { rows } = await tx.query(
        "select full_name from public.profiles where id = $1",
        [b.id],
      );
      expect(rows[0]?.full_name).toBe("Customer B");
    });
  });

  it("lets a customer update their own name, phone and marketing consent", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser("Customer A");

      await tx.as(a);
      const result = await tx.query(
        `update public.profiles
            set full_name = 'Alex A', phone = '07700 900000',
                marketing_consent = true, marketing_consent_source = 'account_page'
          where id = $1`,
        [a.id],
      );
      expect(result.rowCount).toBe(1);

      const { rows } = await tx.query(
        "select full_name, phone, marketing_consent, marketing_consent_at from public.profiles where id = $1",
        [a.id],
      );
      expect(rows[0]).toMatchObject({
        full_name: "Alex A",
        phone: "07700 900000",
        marketing_consent: true,
      });
      expect(rows[0]?.marketing_consent_at).toBeInstanceOf(Date);
    });
  });

  it("doesn't let a customer change their email or id directly", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser();
      await tx.as(a);
      expect(
        await tx.expectError(
          "update public.profiles set email = 'x@example.test' where id = $1",
          [a.id],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("doesn't let a customer create or delete profiles", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser();
      const b = await tx.createUser();
      await tx.as(a);
      expect(
        await tx.expectError(
          "insert into public.profiles (id, email) values (gen_random_uuid(), 'x@example.test')",
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError("delete from public.profiles where id = $1", [
          b.id,
        ]),
      ).toMatch(/permission denied/);
    });
  });

  it("requires a record of how marketing consent was given", async () => {
    await inTransaction(async (tx) => {
      const a = await tx.createUser();
      await tx.as(a);
      expect(
        await tx.expectError(
          "update public.profiles set marketing_consent = true where id = $1",
          [a.id],
        ),
      ).toMatch(/profiles_consent_recorded/);
    });
  });

  it("shows visitors who aren't signed in nothing at all", async () => {
    await inTransaction(async (tx) => {
      await tx.createUser();
      await tx.asAnonymous();
      expect(await tx.expectError("select * from public.profiles")).toMatch(
        /permission denied/,
      );
      expect(await tx.expectError("select * from public.staff")).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("staff access", () => {
  it("lets every staff role read customer profiles, to look people up", async () => {
    await inTransaction(async (tx) => {
      const customer = await tx.createUser("Customer");
      for (const role of ["owner", "admin", "door"] as const) {
        await tx.asSuperuser();
        const member = await tx.createStaff(role);
        await tx.as(member);
        const { rowCount } = await tx.query(
          "select id from public.profiles where id = $1",
          [customer.id],
        );
        expect(rowCount, role).toBe(1);
      }
    });
  });

  it("lets owners and admins correct a customer's details, but not door staff", async () => {
    await inTransaction(async (tx) => {
      const customer = await tx.createUser("Customer");
      const owner = await tx.createStaff("owner");
      const admin = await tx.createStaff("admin");
      const door = await tx.createStaff("door");
      const update = "update public.profiles set phone = $2 where id = $1";

      await tx.as(owner);
      expect((await tx.query(update, [customer.id, "01"])).rowCount).toBe(1);
      await tx.as(admin);
      expect((await tx.query(update, [customer.id, "02"])).rowCount).toBe(1);
      await tx.as(door);
      expect((await tx.query(update, [customer.id, "03"])).rowCount).toBe(0);

      await tx.asSuperuser();
      const { rows } = await tx.query(
        "select phone from public.profiles where id = $1",
        [customer.id],
      );
      expect(rows[0]?.phone).toBe("02");
    });
  });

  it("doesn't let a customer make themselves staff", async () => {
    await inTransaction(async (tx) => {
      const customer = await tx.createUser();
      await tx.as(customer);
      expect(
        await tx.expectError(
          "insert into public.staff (user_id, role) values ($1, 'owner')",
          [customer.id],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("doesn't let admins change the team or their own role", async () => {
    await inTransaction(async (tx) => {
      await tx.createStaff("owner");
      const admin = await tx.createStaff("admin");
      const newcomer = await tx.createUser();

      await tx.as(admin);
      expect(
        await tx.expectError(
          "insert into public.staff (user_id, role) values ($1, 'door')",
          [newcomer.id],
        ),
      ).toMatch(/row-level security/);
      const promote = await tx.query(
        "update public.staff set role = 'owner' where user_id = $1",
        [admin.id],
      );
      expect(promote.rowCount).toBe(0);

      await tx.asSuperuser();
      const { rows } = await tx.query(
        "select role from public.staff where user_id = $1",
        [admin.id],
      );
      expect(rows[0]?.role).toBe("admin");
    });
  });

  it("shows staff their own row, and only owners the whole team", async () => {
    await inTransaction(async (tx) => {
      const owner = await tx.createStaff("owner");
      const admin = await tx.createStaff("admin");
      const door = await tx.createStaff("door");

      await tx.as(door);
      expect((await tx.query("select user_id from public.staff")).rows).toEqual(
        [{ user_id: door.id }],
      );
      await tx.as(admin);
      expect((await tx.query("select user_id from public.staff")).rows).toEqual(
        [{ user_id: admin.id }],
      );
      await tx.as(owner);
      expect(
        (await tx.query("select user_id from public.staff")).rowCount,
      ).toBe(3);
    });
  });

  it("lets owners add, change and remove team members", async () => {
    await inTransaction(async (tx) => {
      const owner = await tx.createStaff("owner");
      const newcomer = await tx.createUser("New helper");

      await tx.as(owner);
      await tx.query(
        "insert into public.staff (user_id, role) values ($1, 'door')",
        [newcomer.id],
      );
      await tx.query(
        "update public.staff set role = 'admin' where user_id = $1",
        [newcomer.id],
      );
      const removed = await tx.query(
        "delete from public.staff where user_id = $1",
        [newcomer.id],
      );
      expect(removed.rowCount).toBe(1);
    });
  });

  it("never leaves Paper Fox without an owner", async () => {
    await inTransaction(async (tx) => {
      const owner = await tx.createStaff("owner");
      await tx.as(owner);
      expect(
        await tx.expectError(
          "update public.staff set role = 'admin' where user_id = $1",
          [owner.id],
        ),
      ).toMatch(/at least one owner/);
      expect(
        await tx.expectError("delete from public.staff where user_id = $1", [
          owner.id,
        ]),
      ).toMatch(/at least one owner/);
    });
  });

  it("lets an owner step down once there's another owner", async () => {
    await inTransaction(async (tx) => {
      const first = await tx.createStaff("owner");
      await tx.createStaff("owner");
      await tx.as(first);
      const result = await tx.query(
        "update public.staff set role = 'admin' where user_id = $1",
        [first.id],
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
