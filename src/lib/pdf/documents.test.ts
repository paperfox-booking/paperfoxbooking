import { describe, expect, it, vi } from "vitest";
import type { EmailSettings } from "@/lib/email/values";
import { statementLines } from "@/lib/bookings/statement";
import {
  documentFileName,
  renderDocument,
  renderStatement,
  statementFileName,
  type DocumentData,
} from "./documents";

vi.mock("server-only", () => ({}));

const settings: EmailSettings = {
  businessName: "Paper Fox",
  legalName: "Paper Fox Events Ltd",
  companyNumber: "13717760",
  address: "Suite 1B, The Hall\nRugby Road\nWolston\nCV8 3FZ",
  website: "https://www.paper-fox.co.uk/",
  facebookUrl: "",
  facebookGroupUrl: "",
  instagramUrl: "",
  signOff: "Nichola & Morag",
  bankName: "",
  bankAccountName: "Paper Fox Events Ltd",
  bankSortCode: "12-34-56",
  bankAccountNumber: "12345678",
  contactEmail: "hello@paper-fox.co.uk",
  phone: "+44 (0)24 7693 7383",
  emailReplyTo: "hello@paper-fox.co.uk",
  emailTestAddress: "",
  sendPaymentEmails: true,
  termsText:
    "## Price and payment\n\n1. Bookings are confirmed once paid.\n\n- One\n- Two",
  termsVersion: 3,
};

const data: DocumentData = {
  settings,
  today: "2026-10-14",
  event: {
    title: "Crop Weekend March 2027",
    startsAt: "2027-03-19T09:00:00Z",
    endsAt: "2027-03-21T17:00:00Z",
    balanceDueOn: "2027-01-26",
    depositHoldDays: 7,
    facebookGroupUrl: "https://www.facebook.com/groups/march2027",
    venueName: "Holiday Inn Coventry",
    classKitsInfo: "",
    joiningInfo: "",
    venueAddress: "Hinckley Road\nCoventry",
    venuePostcode: "CV2 2HP",
    venuePhone: "024 7509 7600",
    venueParking: "Free parking",
    venueAccess: "",
    included: "Your own 4ft crop table\nA welcome goody bag",
    hotelInfo: "Book direct with the hotel for our rate.",
    options: [
      {
        name: "Weekend (4pm start)",
        description: "",
        pricePence: 19500,
        depositPence: 6000,
        onSale: true,
        startsAt: "2027-03-19T16:00:00Z",
      },
    ],
  },
  booking: {
    reference: "PF-2027-0001",
    fullName: "Jo Smith",
    optionName: "Weekend (4pm start)",
    pricePence: 19500,
    depositPence: 6000,
    paidPence: 6000,
    cancelled: false,
    createdAt: "2026-04-01T10:00:00Z",
  },
};

describe("the PDF documents", () => {
  it.each(["booking-details", "confirmation", "terms"] as const)(
    "makes the %s PDF",
    async (kind) => {
      const pdf = await renderDocument(kind, data);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(2000);
    },
    20_000,
  );

  it("makes a blank booking details PDF with no booking", async () => {
    const pdf = await renderDocument("booking-details", {
      ...data,
      booking: null,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("names the files after the event", () => {
    expect(documentFileName("confirmation", "Crop Weekend: March/2027")).toBe(
      "Confirmation - Crop Weekend March2027.pdf",
    );
    expect(documentFileName("terms", "Anything")).toBe(
      "Paper Fox terms and conditions.pdf",
    );
  });
});

describe("the statement", () => {
  const lines = statementLines(
    [
      {
        amount_pence: 6000,
        method: "bank_transfer",
        received_on: "2026-04-02",
        deleted_at: null,
        created_at: "2026-04-02T10:00:00Z",
      },
      {
        amount_pence: 999,
        method: "cash",
        received_on: "2026-04-03",
        deleted_at: "2026-04-03T11:00:00Z",
        created_at: "2026-04-03T10:00:00Z",
      },
      {
        amount_pence: 2000,
        method: "bank_transfer",
        received_on: null,
        deleted_at: null,
        created_at: "2026-10-01T10:00:00Z",
      },
    ],
    [
      {
        amount_pence: 1500,
        method: "cash",
        refunded_on: "2026-05-01",
        deleted_at: null,
        created_at: "2026-05-01T10:00:00Z",
      },
    ],
  );

  it("lists payments and refunds in date order, leaving out removed ones", () => {
    expect(lines).toEqual([
      {
        date: null,
        description: "Paid before the booking system started",
        amountPence: 2000,
      },
      {
        date: "2026-04-02",
        description: "Payment by bank transfer",
        amountPence: 6000,
      },
      { date: "2026-05-01", description: "Refund by cash", amountPence: -1500 },
    ]);
  });

  it("makes the statement PDF, named after the reference", async () => {
    const pdf = await renderStatement({
      settings,
      event: data.event,
      booking: data.booking!,
      lines,
      today: "2026-10-14",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(statementFileName("PF-2027-0001")).toBe(
      "Statement - PF-2027-0001.pdf",
    );
  }, 20_000);
});
