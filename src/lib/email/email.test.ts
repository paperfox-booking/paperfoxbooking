import { describe, expect, it } from "vitest";
import { composeEmail } from "./compose";
import {
  emailText,
  escapeHtml,
  textToHtml,
  type EmailBusiness,
} from "./layout";
import { fillPlaceholders } from "./placeholders";
import {
  bankDetails,
  depositDueBy,
  firstName,
  placeholderValues,
  priceList,
  withArticle,
  type EmailBooking,
  type EmailEvent,
  type EmailSettings,
} from "./values";
import { emailAfterPayment } from "./which-email";

const business: EmailBusiness = {
  businessName: "Paper Fox",
  legalName: "Paper Fox Events Ltd",
  companyNumber: "13717760",
  address: "Suite 1B, The Hall\nRugby Road\nWolston\nCV8 3FZ",
  website: "https://www.paper-fox.co.uk/",
  facebookUrl: "https://www.facebook.com/PaperFoxEvents/",
  facebookGroupUrl: "",
  instagramUrl: "https://www.instagram.com/paperfoxevents/",
  signOff: "Nichola & Morag",
};

const settings: EmailSettings = {
  ...business,
  bankName: "",
  bankAccountName: "Paper Fox Events Ltd",
  bankSortCode: "12-34-56",
  bankAccountNumber: "12345678",
  contactEmail: "hello@paper-fox.co.uk",
  phone: "+44 (0)24 7693 7383",
  emailReplyTo: "hello@paper-fox.co.uk",
  emailTestAddress: "",
  sendPaymentEmails: true,
  termsText: "",
  termsVersion: 1,
};

const event: EmailEvent = {
  title: "Crop Weekend March 2027",
  startsAt: "2027-03-19T09:00:00Z",
  endsAt: "2027-03-21T17:00:00Z",
  balanceDueOn: "2027-01-26",
  depositHoldDays: 7,
  facebookGroupUrl: "https://www.facebook.com/groups/march2027",
  venueName: "Holiday Inn Coventry",
  classKitsInfo: "",
  joiningInfo: " Arrive from 3pm \n",
  options: [
    {
      name: "Weekend (4pm start)",
      pricePence: 19500,
      depositPence: 6000,
      onSale: true,
    },
    {
      name: "Friday Kick Starter (9am start)",
      pricePence: 24500,
      depositPence: 8500,
      onSale: true,
    },
    {
      name: "Old option",
      pricePence: 15000,
      depositPence: null,
      onSale: false,
    },
  ],
};

const booking: EmailBooking = {
  reference: "PF-2027-0001",
  fullName: "Jo Anne Smith",
  optionName: "Weekend (4pm start)",
  pricePence: 19500,
  depositPence: 6000,
  paidPence: 6000,
  cancelled: false,
  // 23:30 on 31 March in the UK (British Summer Time).
  createdAt: "2026-03-31T22:30:00Z",
};

describe("fillPlaceholders", () => {
  it("fills in known placeholders and lists unknown and empty ones", () => {
    expect(
      fillPlaceholders("Hello {{ first_name }}, {{frist_name}} {{deposit}}", {
        first_name: "Jo",
        deposit: "",
      }),
    ).toEqual({
      text: "Hello Jo, {{frist_name}} ",
      unknown: ["frist_name"],
      empty: ["deposit"],
    });
  });
});

describe("emailAfterPayment", () => {
  it("sends B2 when the deposit is covered", () => {
    expect(emailAfterPayment("unpaid", "deposit_paid")).toBe("B2");
    expect(emailAfterPayment("part_paid", "deposit_paid")).toBe("B2");
  });

  it("sends B3 when they've paid in full, all at once or with the balance", () => {
    expect(emailAfterPayment("unpaid", "paid")).toBe("B3");
    expect(emailAfterPayment("deposit_paid", "paid")).toBe("B3");
  });

  it("thanks them for any other payment", () => {
    expect(emailAfterPayment("unpaid", "part_paid")).toBe("thanks");
    expect(emailAfterPayment("deposit_paid", "deposit_paid")).toBe("thanks");
  });

  it("sends nothing for cancelled bookings, free places or overpayments", () => {
    expect(emailAfterPayment("unpaid", "cancelled")).toBeNull();
    expect(emailAfterPayment("paid", "paid")).toBeNull();
    expect(emailAfterPayment("free", "free")).toBeNull();
  });
});

describe("textToHtml", () => {
  it("makes paragraphs, line breaks and lists, and escapes everything", () => {
    expect(textToHtml("Hello <Jo> & co\nLine two\n\n- one\n- two")).toBe(
      '<p style="margin:0 0 16px;">Hello &lt;Jo&gt; &amp; co<br>Line two</p>\n' +
        '<ul style="margin:0 0 16px;padding-left:24px;"><li style="margin:0 0 8px;">one</li><li style="margin:0 0 8px;">two</li></ul>',
    );
  });

  it("turns web and email addresses into links, leaving out the full stop", () => {
    const html = textToHtml(
      "See www.paper-fox.co.uk. Or email hello@paper-fox.co.uk",
    );
    expect(html).toContain('href="https://www.paper-fox.co.uk"');
    expect(html).toContain(">www.paper-fox.co.uk</a>.");
    expect(html).toContain('href="mailto:hello@paper-fox.co.uk"');
  });

  it("doesn't let a link break out of its attribute", () => {
    expect(textToHtml('https://example.test/"onclick=x')).not.toContain(
      '"onclick',
    );
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });
});

describe("emailText", () => {
  it("adds the sign-off, social links and company details", () => {
    const text = emailText("Hello Jo", business);
    expect(text).toContain(
      "Regards\n\nNichola & Morag\nPaper Fox\nwww.paper-fox.co.uk",
    );
    expect(text).toContain(
      "Instagram: https://www.instagram.com/paperfoxevents/",
    );
    expect(text).not.toContain("Facebook group:");
    expect(text).toContain(
      "Paper Fox Events Ltd, company number 13717760. Suite 1B, The Hall, Rugby Road, Wolston, CV8 3FZ",
    );
  });
});

describe("values for a booking", () => {
  it("uses the first word of a name", () => {
    expect(firstName("  Jo Anne Smith ")).toBe("Jo");
  });

  it("lists only options on sale, with their deposits", () => {
    expect(priceList(event.options)).toBe(
      "- Weekend (4pm start): £195, with a £60 deposit\n- Friday Kick Starter (9am start): £245, with an £85 deposit",
    );
  });

  it("says a or an to match how the price sounds", () => {
    expect(withArticle("£60")).toBe("a £60");
    expect(withArticle("£85")).toBe("an £85");
    expect(withArticle("£8.50")).toBe("an £8.50");
    expect(withArticle("£11")).toBe("an £11");
    expect(withArticle("£11.50")).toBe("an £11.50");
    expect(withArticle("£18,000")).toBe("an £18,000");
    expect(withArticle("£110")).toBe("a £110");
    expect(withArticle("£1,800")).toBe("a £1,800");
  });

  it("gives the bank details with their reference, or nothing until they're added", () => {
    expect(bankDetails(settings, "PF-2027-0001")).toBe(
      "Account name: Paper Fox Events Ltd\nSort code: 12-34-56\nAccount number: 12345678\nReference: PF-2027-0001",
    );
    expect(bankDetails({ ...settings, bankSortCode: "" }, "PF-2027-0001")).toBe(
      "",
    );
  });

  it("holds a place for the event's hold days from the UK date it was booked", () => {
    expect(depositDueBy(event, booking)).toBe("2026-04-07");
  });

  it("fills in money and dates in words", () => {
    const values = placeholderValues({
      settings,
      event,
      booking,
      payment: { amountPence: 6000, receivedOn: "2026-04-02" },
      today: "2026-10-14",
    });
    expect(values).toMatchObject({
      first_name: "Jo",
      reference: "PF-2027-0001",
      event_dates: "Friday 19 to Sunday 21 March 2027",
      total: "£195",
      paid: "£60",
      balance: "£135",
      deposit: "£60",
      deposit_due_by: "Tuesday 7 April 2026",
      balance_due_on: "Tuesday 26 January 2027",
      amount_received: "£60",
      received_on: "Thursday 2 April 2026",
      facebook_group: "https://www.facebook.com/groups/march2027",
      joining_info: "Arrive from 3pm",
      class_kits_info: "",
      sign_off: "Nichola & Morag",
    });
  });
});

describe("values for a refund", () => {
  it("fills in the latest refund, or nothing without one", () => {
    const base = {
      settings,
      event,
      booking: { ...booking, cancelled: true, paidPence: 6000 },
      payment: null,
      today: "2026-10-14",
    };
    expect(
      placeholderValues({
        ...base,
        refund: { amountPence: 13500, refundedOn: "2026-10-02" },
      }),
    ).toMatchObject({
      amount_refunded: "£135",
      refunded_on: "Friday 2 October 2026",
      paid: "£60",
    });
    expect(placeholderValues(base)).toMatchObject({
      amount_refunded: "",
      refunded_on: "",
    });
  });
});

describe("composeEmail", () => {
  it("fills in the wording and warns about anything missing", () => {
    const values = placeholderValues({
      settings: { ...settings, bankSortCode: "" },
      event,
      booking,
      payment: null,
      today: "2026-10-14",
    });
    const email = composeEmail({
      wording: {
        subject: "{{event}}:\n thank you",
        body: "Hello {{first_name}}\n\n{{bank_details}}\n\n{{balnce}}",
      },
      values,
      business,
      logoUrl: "https://book.paper-fox.co.uk/brand/fox-mark.png",
    });
    expect(email.subject).toBe("Crop Weekend March 2027: thank you");
    expect(email.text.startsWith("Hello Jo")).toBe(true);
    expect(email.html).toContain(
      "<title>Crop Weekend March 2027: thank you</title>",
    );
    expect(email.html).toContain("Hello Jo");
    expect(email.warnings).toEqual([
      "{{balnce}} isn't a placeholder this system knows, so it's sent as it is. Check the spelling.",
      "The bank details are empty. An owner can add them in Settings.",
    ]);
  });
});

describe("notes left in the wording", () => {
  it("warns about [square bracket] notes still to replace", () => {
    const email = composeEmail({
      wording: { subject: "Hello", body: "Hello\n\n[Add the timetable.]" },
      values: placeholderValues({
        settings,
        event,
        booking,
        payment: null,
        today: "2026-10-14",
      }),
      business,
      logoUrl: "",
    });
    expect(email.warnings).toContain(
      "The wording still has a note in [square brackets] to replace. Change it on the Emails page first.",
    );
  });
});
