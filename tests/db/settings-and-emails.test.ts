import { afterAll, describe, expect, it } from "vitest";
import { inTransaction, pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("settings", () => {
  it("only owners can change them; admins can read them; others can't", async () => {
    await inTransaction(async (tx) => {
      const owner = await tx.createStaff("owner");
      const admin = await tx.createStaff("admin");
      const others = [await tx.createStaff("door"), await tx.createUser()];
      await tx.as(owner);
      const changed = await tx.query(
        "update public.settings set bank_sort_code = '12-34-56', bank_account_number = '12345678'",
      );
      expect(changed.rowCount).toBe(1);

      await tx.as(admin);
      const read = await tx.query<{ bank_sort_code: string }>(
        "select bank_sort_code from public.settings",
      );
      expect(read.rows[0]?.bank_sort_code).toBe("12-34-56");
      const adminChange = await tx.query(
        "update public.settings set bank_sort_code = '00-00-00'",
      );
      expect(adminChange.rowCount).toBe(0);

      for (const who of others) {
        await tx.as(who);
        const { rowCount } = await tx.query("select 1 from public.settings");
        expect(rowCount).toBe(0);
      }

      await tx.asAnonymous();
      expect(await tx.expectError("select 1 from public.settings")).toMatch(
        /permission denied/,
      );
    });
  });

  it("checks bank details and email addresses look right", async () => {
    await inTransaction(async (tx) => {
      await tx.as(await tx.createStaff("owner"));
      expect(
        await tx.expectError(
          "update public.settings set bank_sort_code = '123456'",
        ),
      ).toMatch(/settings_sort_code/);
      expect(
        await tx.expectError(
          "update public.settings set email_test_address = 'not an email'",
        ),
      ).toMatch(/settings_emails/);
    });
  });

  it("keeps every version of the terms", async () => {
    await inTransaction(async (tx) => {
      const before = await tx.query<{ terms_version: number }>(
        "select terms_version from public.settings",
      );
      const version = before.rows[0]!.terms_version;

      await tx.as(await tx.createStaff("owner"));
      await tx.query("update public.settings set terms_text = 'New terms'");
      // Changing something else doesn't make a new version.
      await tx.query("update public.settings set sign_off = 'Nichola'");
      const after = await tx.query<{ terms_version: number }>(
        "select terms_version from public.settings",
      );
      expect(after.rows[0]?.terms_version).toBe(version + 1);
      // Nobody can set the version by hand.
      expect(
        await tx.expectError("update public.settings set terms_version = 1"),
      ).toMatch(/permission denied/);

      // The terms are public, every version of them.
      await tx.asAnonymous();
      const { rows } = await tx.query<{ terms_text: string }>(
        "select terms_text from public.terms_versions where version = $1",
        [version + 1],
      );
      expect(rows[0]?.terms_text).toBe("New terms");
      expect(
        await tx.expectError(
          "insert into public.terms_versions (version, terms_text) values (999, 'x')",
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("email wording", () => {
  it("can be changed by owners and admins, but not door staff", async () => {
    await inTransaction(async (tx) => {
      const door = await tx.createStaff("door");
      await tx.as(await tx.createStaff("admin"));
      const changed = await tx.query(
        "update public.email_templates set subject = 'Thank you' where key = 'B2'",
      );
      expect(changed.rowCount).toBe(1);
      expect(
        await tx.expectError(
          "update public.email_templates set key = 'B9' where key = 'B2'",
        ),
      ).toMatch(/permission denied/);

      await tx.as(door);
      const doorChange = await tx.query(
        "update public.email_templates set subject = 'x' where key = 'B2'",
      );
      expect(doorChange.rowCount).toBe(0);
      const { rowCount } = await tx.query(
        "select 1 from public.email_templates",
      );
      expect(rowCount).toBe(0);
    });
  });
});

describe("the email log", () => {
  it("records emails the system sends, and nobody can change it", async () => {
    await inTransaction(async (tx) => {
      const event = await tx.createEvent();
      const customer = await tx.createCustomer();
      const booking = await tx.createBooking(event, customer);
      const admin = await tx.createStaff("admin");
      const door = await tx.createStaff("door");
      await tx.as(admin);

      const logged = await tx.query<{ id: string }>(
        `select public.log_email($1, 'B2', 'Thank you', 'jo@example.test', 'Hello Jo',
           array['confirmation.pdf'], true, 'msg_1', '') as id`,
        [booking.id],
      );
      const id = logged.rows[0]!.id;
      const { rows } = await tx.query<{
        status: string;
        customer_id: string;
        outside_system: boolean;
        created_by: string;
        sent_on: Date | null;
      }>(
        "select status, customer_id, outside_system, created_by, sent_on from public.email_log where id = $1",
        [id],
      );
      expect(rows[0]).toMatchObject({
        status: "sent",
        customer_id: customer,
        outside_system: false,
        created_by: admin.id,
      });
      expect(rows[0]?.sent_on).not.toBeNull();

      const failed = await tx.query<{ id: string }>(
        `select public.log_email($1, 'B3', 'Thank you', 'jo@example.test', 'Hello Jo',
           '{}', false, null, 'Mailbox full') as id`,
        [booking.id],
      );
      const failure = await tx.query<{ status: string; error: string }>(
        "select status, error from public.email_log where id = $1",
        [failed.rows[0]!.id],
      );
      expect(failure.rows[0]).toEqual({
        status: "failed",
        error: "Mailbox full",
      });

      expect(
        await tx.expectError(
          "update public.email_log set status = 'delivered' where id = $1",
          [id],
        ),
      ).toMatch(/permission denied/);
      expect(
        await tx.expectError("delete from public.email_log where id = $1", [
          id,
        ]),
      ).toMatch(/permission denied/);

      await tx.as(door);
      expect(
        await tx.expectError(
          `select public.log_email($1, 'B2', 'x', 'x@example.test', 'x', '{}', true, null, '')`,
          [booking.id],
        ),
      ).toMatch(/Only owners and admins/);
    });
  });
});
