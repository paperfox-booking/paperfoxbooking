import { describe, expect, it } from "vitest";
import { pickAudience, type AudiencePerson } from "./audience";

function person(
  name: string,
  partial: Partial<AudiencePerson> = {},
): AudiencePerson {
  return {
    bookingId: name,
    reference: "PF-2027-0001",
    fullName: name,
    email: `${name}@example.test`,
    isTeam: false,
    cancelled: false,
    pricePence: 19500,
    depositPence: 6000,
    paidPence: 0,
    sentTemplates: [],
    ...partial,
  };
}

const people = [
  person("unpaid"),
  person("part", { paidPence: 3000 }),
  person("deposit", { paidPence: 6000, sentTemplates: ["B1", "B2"] }),
  person("paid", { paidPence: 19500, sentTemplates: ["B3"] }),
  person("team", { isTeam: true, pricePence: 0, depositPence: null }),
  person("cancelled", { cancelled: true }),
];

function names(
  audience: Parameters<typeof pickAudience>[1],
  options: Partial<Parameters<typeof pickAudience>[2]> = {},
) {
  return pickAudience(people, audience, {
    template: "B2",
    includeTeam: false,
    balanceDueOn: "2027-01-26",
    today: "2026-10-14",
    ...options,
  }).map((picked) => picked.fullName);
}

describe("pickAudience", () => {
  it("leaves out cancelled bookings, and the team unless asked", () => {
    expect(names("everyone")).toEqual(["unpaid", "part", "deposit", "paid"]);
    expect(names("everyone", { includeTeam: true })).toContain("team");
  });

  it("finds who owes money, and who's overdue", () => {
    expect(names("owes")).toEqual(["unpaid", "part", "deposit"]);
    expect(names("overdue")).toEqual([]);
    expect(names("overdue", { today: "2027-01-27" })).toEqual([
      "unpaid",
      "part",
      "deposit",
    ]);
  });

  it("finds who hasn't paid their deposit", () => {
    expect(names("no_deposit")).toEqual(["unpaid", "part"]);
  });

  it("finds who hasn't had this email", () => {
    expect(names("not_had")).toEqual(["unpaid", "part", "paid"]);
    expect(names("not_had", { template: null })).toHaveLength(4);
  });
});
