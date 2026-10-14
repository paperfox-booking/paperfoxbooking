import { describe, expect, it } from "vitest";
import { toPersonRow, type BookingSelect } from "./people";

const booking: BookingSelect = {
  id: "b",
  reference: "PF-2027-0001",
  ticket_type_id: null,
  room_id: null,
  price_pence: 19500,
  deposit_pence: 6000,
  price_note: "",
  notes: "",
  payment_notes: "",
  cancelled_at: null,
  checked_in_at: null,
  customer: {
    id: "ann",
    full_name: "Ann Second",
    email: null,
    phone: "",
    emergency_contact: "",
    dietary_health: "",
    is_team: false,
  },
  payments: [
    { amount_pence: 19500, deleted_at: null },
    { amount_pence: 100, deleted_at: "2026-10-01T10:00:00Z" },
  ],
  refunds: [{ amount_pence: 13500, deleted_at: null }],
  email_log: [
    {
      template: "joining",
      sent_on: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
      status: "sent",
      customer_id: "jo",
    },
    {
      template: "B3",
      sent_on: "2026-10-05",
      created_at: "2026-10-05T10:00:00Z",
      status: "sent",
      customer_id: "ann",
    },
    {
      template: "B1",
      sent_on: "2026-03-01",
      created_at: "2026-03-01T10:00:00Z",
      status: "sent",
      customer_id: null,
    },
  ],
};

describe("toPersonRow", () => {
  it("takes refunds off what's been paid", () => {
    expect(toPersonRow(booking).paidPence).toBe(6000);
  });

  it("ignores emails to someone who had the place before it was passed on", () => {
    expect(toPersonRow(booking).lastEmail).toEqual({
      template: "B3",
      sentOn: "2026-10-05",
    });
  });
});
