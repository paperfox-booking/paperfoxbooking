import { describe, expect, it } from "vitest";
import {
  accountNumber,
  settingsSchema,
  sortCode,
  templateSchema,
} from "./settings";

const valid = {
  businessName: "Paper Fox",
  legalName: "Paper Fox Events Ltd",
  companyNumber: "13717760",
  contactEmail: "Hello@Paper-Fox.co.uk",
  phone: "",
  address: "Suite 1B\r\nWolston",
  website: "www.paper-fox.co.uk",
  facebookUrl: "",
  facebookGroupUrl: "",
  instagramUrl: "",
  signOff: "Nichola & Morag",
  bankName: "",
  bankAccountName: "",
  bankSortCode: "12 34 56",
  bankAccountNumber: "1234 5678",
  emailReplyTo: "hello@paper-fox.co.uk",
  emailTestAddress: "",
  sendPaymentEmails: "on",
  termsText: "Line one\r\n\r\nLine two\r\n",
};

describe("settings", () => {
  it("tidies what was typed into what's stored", () => {
    const parsed = settingsSchema.parse(valid);
    expect(parsed).toMatchObject({
      contact_email: "hello@paper-fox.co.uk",
      address: "Suite 1B\nWolston",
      website: "https://www.paper-fox.co.uk/",
      facebook_url: "",
      bank_sort_code: "12-34-56",
      bank_account_number: "12345678",
      email_test_address: "",
      send_payment_emails: true,
      terms_text: "Line one\n\nLine two",
    });
  });

  it("explains bank detail mistakes", () => {
    expect(sortCode.safeParse("12345").error?.issues[0]?.message).toBe(
      "Enter the 6 digit sort code, like 12-34-56",
    );
    expect(accountNumber.safeParse("1234567").error?.issues[0]?.message).toBe(
      "Enter the 8 digit account number",
    );
    const half = settingsSchema.safeParse({ ...valid, bankAccountNumber: "" });
    expect(half.error?.issues[0]?.message).toBe(
      "Enter both the sort code and the account number, or neither",
    );
  });

  it("needs the contact and reply-to addresses, and terms", () => {
    const result = settingsSchema.safeParse({
      ...valid,
      contactEmail: "",
      termsText: "  ",
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Enter the email address customers can use",
      "Enter the terms and conditions",
    ]);
  });
});

describe("email wording", () => {
  it("keeps the subject on one line and tidies new lines", () => {
    expect(
      templateSchema.parse({
        subject: "  Thank\n you  ",
        body: "Hello\r\n\r\nThanks",
        attachBookingDetails: "",
        attachConfirmation: "on",
        attachTerms: "",
      }),
    ).toEqual({
      subject: "Thank you",
      body: "Hello\n\nThanks",
      attach_booking_details: false,
      attach_confirmation: true,
      attach_terms: false,
    });
  });
});
