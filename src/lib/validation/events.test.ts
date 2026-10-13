import { describe, expect, it } from "vitest";
import {
  copyEventSchema,
  eventFormSchema,
  optionFormSchema,
  venueFormSchema,
} from "./events";
import { fieldErrorsFrom } from "./form";

const march = {
  title: " Coventry Crop Weekend March 2027 ",
  summary: "",
  description: "",
  included: "Goody bag\nTea and coffee",
  hotelInfo: "",
  classKitsInfo: "",
  joiningInfo: "",
  facebookGroupUrl: "www.facebook.com/groups/march2027",
  venueId: "6f1c3c3a-6a43-4b8f-9d7e-2a1f0e5b9c11",
  startDate: "2027-03-19",
  startTime: "09:00",
  endDate: "2027-03-21",
  endTime: "17:00",
  capacity: "110",
  balanceDueOn: "2027-01-26",
  depositHoldDays: "7",
  bookingOpensDate: "",
  bookingOpensTime: "",
  bookingClosesDate: "",
  bookingClosesTime: "",
};

function errorsOf(result: { success: boolean; error?: unknown }) {
  expect(result.success).toBe(false);
  return fieldErrorsFrom(result.error as never);
}

describe("eventFormSchema", () => {
  it("turns the form into a row, with times in UTC", () => {
    expect(eventFormSchema.parse(march)).toEqual({
      title: "Coventry Crop Weekend March 2027",
      summary: "",
      description: "",
      included: "Goody bag\nTea and coffee",
      hotel_info: "",
      class_kits_info: "",
      joining_info: "",
      facebook_group_url: "https://www.facebook.com/groups/march2027",
      venue_id: march.venueId,
      starts_at: "2027-03-19T09:00:00.000Z",
      ends_at: "2027-03-21T17:00:00.000Z",
      capacity: 110,
      balance_due_on: "2027-01-26",
      deposit_hold_days: 7,
      booking_opens_at: null,
      booking_closes_at: null,
    });
  });

  it("uses British Summer Time in summer, and fills in booking times", () => {
    const row = eventFormSchema.parse({
      ...march,
      startDate: "2027-06-18",
      endDate: "2027-06-20",
      balanceDueOn: "2027-05-07",
      bookingOpensDate: "2026-06-22",
      bookingClosesDate: "2027-06-11",
    });
    expect(row.starts_at).toBe("2027-06-18T08:00:00.000Z");
    expect(row.booking_opens_at).toBe("2026-06-22T08:00:00.000Z");
    expect(row.booking_closes_at).toBe("2027-06-11T22:59:00.000Z");
  });

  it("explains what's missing", () => {
    const errors = errorsOf(
      eventFormSchema.safeParse({
        ...march,
        title: "  ",
        venueId: "",
        capacity: "",
        startDate: "",
      }),
    );
    expect(errors).toMatchObject({
      title: "Enter the event's name",
      venueId: "Choose where the event is",
      capacity: "Enter the most people the event can take",
      startDate: "Enter the date the event starts",
    });
  });

  it("refuses impossible numbers and dates", () => {
    const errors = errorsOf(
      eventFormSchema.safeParse({
        ...march,
        capacity: "110.5",
        depositHoldDays: "0",
        balanceDueOn: "2027-02-30",
        startTime: "9am",
      }),
    );
    expect(errors).toMatchObject({
      capacity: "Enter a whole number, like 110",
      depositHoldDays: "Enter 1 or more",
      balanceDueOn: "Enter a real date, like 19/03/2027",
      startTime: "Enter a time like 09:00 or 16:00",
    });
  });

  it("checks the dates are in the right order", () => {
    expect(
      errorsOf(eventFormSchema.safeParse({ ...march, endDate: "2027-03-18" })),
    ).toEqual({
      endDate: "The event must end after it starts. Check the end date.",
    });
    expect(
      errorsOf(
        eventFormSchema.safeParse({ ...march, balanceDueOn: "2027-03-19" }),
      ),
    ).toEqual({
      balanceDueOn: "The balance must be due before the event starts.",
    });
    expect(
      errorsOf(
        eventFormSchema.safeParse({
          ...march,
          bookingOpensDate: "2026-04-01",
          bookingClosesDate: "2026-03-01",
        }),
      ),
    ).toEqual({ bookingClosesDate: "Booking must close after it opens." });
    expect(
      errorsOf(
        eventFormSchema.safeParse({
          ...march,
          bookingClosesDate: "2027-03-22",
        }),
      ),
    ).toEqual({
      bookingClosesDate: "Booking must close before the event ends.",
    });
  });

  it("asks for a proper Facebook address", () => {
    expect(
      errorsOf(
        eventFormSchema.safeParse({ ...march, facebookGroupUrl: "my group" }),
      ).facebookGroupUrl,
    ).toMatch(/full web address/);
    expect(
      eventFormSchema.parse({ ...march, facebookGroupUrl: "" })
        .facebook_group_url,
    ).toBeNull();
  });
});

describe("optionFormSchema", () => {
  const weekend = {
    name: "Weekend (4pm start)",
    description: "Friday 4pm to Sunday 5pm",
    price: "195",
    deposit: "£60",
    startDate: "2027-03-19",
    startTime: "16:00",
    capacity: "",
    sortOrder: "",
    onSale: "on",
  };

  it("turns pounds into pence", () => {
    expect(optionFormSchema.parse(weekend)).toEqual({
      name: "Weekend (4pm start)",
      description: "Friday 4pm to Sunday 5pm",
      price_pence: 19500,
      deposit_pence: 6000,
      starts_at: "2027-03-19T16:00:00.000Z",
      capacity: null,
      sort_order: 0,
      on_sale: true,
    });
    expect(
      optionFormSchema.parse({ ...weekend, price: "245.50", deposit: "" }),
    ).toMatchObject({ price_pence: 24550, deposit_pence: null });
  });

  it("keeps the deposit below the price", () => {
    expect(
      errorsOf(optionFormSchema.safeParse({ ...weekend, deposit: "195" }))
        .deposit,
    ).toMatch(/less than the full price/);
    expect(
      errorsOf(optionFormSchema.safeParse({ ...weekend, deposit: "0" }))
        .deposit,
    ).toMatch(/Leave the deposit empty/);
  });

  it("explains a price it can't read", () => {
    expect(
      errorsOf(optionFormSchema.safeParse({ ...weekend, price: "£195.999" }))
        .price,
    ).toBe("Enter an amount in pounds, like 195 or 195.50");
  });

  it("needs both a start date and time, or neither", () => {
    expect(
      errorsOf(optionFormSchema.safeParse({ ...weekend, startTime: "" }))
        .startTime,
    ).toMatch(/both the date and time/);
    expect(
      optionFormSchema.parse({ ...weekend, startDate: "", startTime: "" })
        .starts_at,
    ).toBeNull();
  });

  it("treats an unticked box as not on sale", () => {
    expect(optionFormSchema.parse({ ...weekend, onSale: "" }).on_sale).toBe(
      false,
    );
  });
});

describe("copyEventSchema", () => {
  it("needs a name and a real start date", () => {
    expect(
      errorsOf(
        copyEventSchema.safeParse({ title: "", startDate: "2027-02-30" }),
      ),
    ).toEqual({
      title: "Enter a name for the new event",
      startDate: "Enter a real date, like 19/03/2027",
    });
  });
});

describe("venueFormSchema", () => {
  it("tidies the postcode and web address", () => {
    expect(
      venueFormSchema.parse({
        name: "Holiday Inn Coventry",
        address: "Hinckley Road\nCoventry",
        postcode: "cv2 2hp",
        phone: "024 7509 7600",
        mapUrl: "maps.google.com/?q=CV2+2HP",
        parking: "Free",
        accessInfo: "",
      }),
    ).toMatchObject({
      postcode: "CV2 2HP",
      map_url: "https://maps.google.com/?q=CV2+2HP",
    });
  });
});
