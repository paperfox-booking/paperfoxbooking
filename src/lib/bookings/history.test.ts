import { describe, expect, it } from "vitest";
import { describeChange, type AuditEntry } from "./history";

const names = {
  options: new Map([
    ["weekend", "Weekend (4pm start)"],
    ["kick", "Friday Kick Starter (9am start)"],
  ]),
  rooms: new Map([["main", "Main room"]]),
};

function entry(partial: Partial<AuditEntry>): AuditEntry {
  return {
    table_name: "bookings",
    action: "update",
    old_values: {},
    new_values: {},
    changed_at: "2026-10-14T10:00:00Z",
    ...partial,
  };
}

describe("describeChange", () => {
  it("describes a new booking", () => {
    expect(
      describeChange(
        entry({
          action: "insert",
          old_values: null,
          new_values: { source: "import", price_pence: 19500 },
        }),
        names,
      ),
    ).toEqual(["Booked, imported from the spreadsheet, at £195."]);
  });

  it("lists each change in plain English", () => {
    expect(
      describeChange(
        entry({
          old_values: {
            ticket_type_id: "weekend",
            price_pence: 19500,
            room_id: null,
            notes: "",
          },
          new_values: {
            ticket_type_id: "kick",
            price_pence: 24500,
            room_id: "main",
            notes: "Sit with Jo",
          },
        }),
        names,
      ),
    ).toEqual([
      "Total due changed from £195 to £245.",
      "Option changed from Weekend (4pm start) to Friday Kick Starter (9am start).",
      "Room changed from no room to Main room.",
      'Notes changed from nothing to "Sit with Jo".',
    ]);
  });

  it("describes cancelling and reinstating", () => {
    expect(
      describeChange(
        entry({
          old_values: { cancelled_at: null },
          new_values: {
            cancelled_at: "2026-10-14T10:00:00Z",
            cancel_reason: "Can't come",
          },
        }),
        names,
      ),
    ).toEqual(["Cancelled: Can't come."]);
    expect(
      describeChange(
        entry({
          old_values: { cancelled_at: "2026-10-14T10:00:00Z" },
          new_values: { cancelled_at: null },
        }),
        names,
      ),
    ).toEqual(["Reinstated."]);
  });

  it("describes payments recorded and removed", () => {
    expect(
      describeChange(
        entry({
          table_name: "payments",
          action: "insert",
          old_values: null,
          new_values: {
            amount_pence: 6000,
            method: "bank_transfer",
            received_on: "2026-03-22",
          },
        }),
        names,
      ),
    ).toEqual([
      "Payment of £60 recorded (bank transfer, received 22/03/2026).",
    ]);
    expect(
      describeChange(
        entry({
          table_name: "payments",
          old_values: { amount_pence: 6000, deleted_at: null },
          new_values: {
            amount_pence: 6000,
            deleted_at: "2026-10-14T10:00:00Z",
            delete_reason: "Recorded twice",
          },
        }),
        names,
      ),
    ).toEqual(["Payment of £60 removed: Recorded twice."]);
  });

  it("leaves out changes that don't matter to the team", () => {
    expect(
      describeChange(
        entry({
          old_values: { updated_at: "a", notes: "x" },
          new_values: { updated_at: "b", notes: "x" },
        }),
        names,
      ),
    ).toEqual([]);
  });
});
