import { z } from "zod";
import { daysBetween, ukDateTimeToUtc } from "@/lib/dates";
import {
  checkbox,
  optionalDate,
  optionalPounds,
  optionalText,
  optionalTime,
  optionalWebAddress,
  optionalWholeNumber,
  requiredDate,
  requiredPounds,
  requiredText,
  requiredTime,
  wholeNumber,
} from "./form";

/**
 * The team's event, option and venue forms. Shared by the forms (to know the
 * field names) and the server actions (which check every value).
 */

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const EVENT_FIELDS = [
  "title",
  "summary",
  "description",
  "included",
  "hotelInfo",
  "facebookGroupUrl",
  "venueId",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "capacity",
  "balanceDueOn",
  "depositHoldDays",
  "bookingOpensDate",
  "bookingOpensTime",
  "bookingClosesDate",
  "bookingClosesTime",
] as const;
export type EventField = (typeof EVENT_FIELDS)[number];

/** What's saved to the events table. */
export interface EventRow {
  title: string;
  summary: string;
  description: string;
  included: string;
  hotel_info: string;
  facebook_group_url: string | null;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  balance_due_on: string;
  deposit_hold_days: number;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
}

function moment(date: string, time: string): string {
  return ukDateTimeToUtc(date, time).toISOString();
}

export const eventFormSchema = z
  .object({
    title: requiredText(120, "Enter the event's name"),
    summary: optionalText(300),
    description: optionalText(5000),
    included: optionalText(3000),
    hotelInfo: optionalText(3000),
    facebookGroupUrl: optionalWebAddress,
    venueId: z.uuid({ error: "Choose where the event is" }),
    startDate: requiredDate("Enter the date the event starts"),
    startTime: requiredTime("Enter the time the event starts"),
    endDate: requiredDate("Enter the date the event ends"),
    endTime: requiredTime("Enter the time the event ends"),
    capacity: wholeNumber(1, 2000, {
      missing: "Enter the most people the event can take",
      example: "110",
    }),
    balanceDueOn: requiredDate("Enter the date the balance is due"),
    depositHoldDays: wholeNumber(1, 60, {
      missing: "Enter how many days to hold a place for its deposit",
      example: "7",
    }),
    bookingOpensDate: optionalDate,
    bookingOpensTime: optionalTime,
    bookingClosesDate: optionalDate,
    bookingClosesTime: optionalTime,
  })
  .transform((form, context): EventRow => {
    const startsAt = moment(form.startDate, form.startTime);
    const endsAt = moment(form.endDate, form.endTime);
    const opensAt = form.bookingOpensDate
      ? moment(form.bookingOpensDate, form.bookingOpensTime || "09:00")
      : null;
    const closesAt = form.bookingClosesDate
      ? moment(form.bookingClosesDate, form.bookingClosesTime || "23:59")
      : null;

    if (endsAt <= startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The event must end after it starts. Check the end date.",
      });
    }
    if (daysBetween(form.balanceDueOn, form.startDate) <= 0) {
      context.addIssue({
        code: "custom",
        path: ["balanceDueOn"],
        message: "The balance must be due before the event starts.",
      });
    }
    if (!form.bookingOpensDate && form.bookingOpensTime) {
      context.addIssue({
        code: "custom",
        path: ["bookingOpensDate"],
        message: "Enter the date booking opens, or clear the time.",
      });
    }
    if (!form.bookingClosesDate && form.bookingClosesTime) {
      context.addIssue({
        code: "custom",
        path: ["bookingClosesDate"],
        message: "Enter the date booking closes, or clear the time.",
      });
    }
    if (opensAt && closesAt && closesAt <= opensAt) {
      context.addIssue({
        code: "custom",
        path: ["bookingClosesDate"],
        message: "Booking must close after it opens.",
      });
    }
    if (closesAt && closesAt > endsAt) {
      context.addIssue({
        code: "custom",
        path: ["bookingClosesDate"],
        message: "Booking must close before the event ends.",
      });
    }

    return {
      title: form.title,
      summary: form.summary,
      description: form.description,
      included: form.included,
      hotel_info: form.hotelInfo,
      facebook_group_url: form.facebookGroupUrl,
      venue_id: form.venueId,
      starts_at: startsAt,
      ends_at: endsAt,
      capacity: form.capacity,
      balance_due_on: form.balanceDueOn,
      deposit_hold_days: form.depositHoldDays,
      booking_opens_at: opensAt,
      booking_closes_at: closesAt,
    };
  });

// ---------------------------------------------------------------------------
// Options (ticket types)
// ---------------------------------------------------------------------------

export const OPTION_FIELDS = [
  "name",
  "description",
  "price",
  "deposit",
  "startDate",
  "startTime",
  "capacity",
  "sortOrder",
  "onSale",
] as const;
export type OptionField = (typeof OPTION_FIELDS)[number];

export interface OptionRow {
  name: string;
  description: string;
  price_pence: number;
  deposit_pence: number | null;
  starts_at: string | null;
  capacity: number | null;
  sort_order: number;
  on_sale: boolean;
}

export const optionFormSchema = z
  .object({
    name: requiredText(80, "Enter the option's name, like Weekend (4pm start)"),
    description: optionalText(1000),
    price: requiredPounds("Enter the full price, like 195"),
    deposit: optionalPounds,
    startDate: optionalDate,
    startTime: optionalTime,
    capacity: optionalWholeNumber(1, 2000, "40"),
    sortOrder: optionalWholeNumber(0, 1000, "1"),
    onSale: checkbox,
  })
  .transform((form, context): OptionRow => {
    if (form.deposit !== null && form.deposit === 0) {
      context.addIssue({
        code: "custom",
        path: ["deposit"],
        message: "Leave the deposit empty if people pay in full.",
      });
    } else if (form.deposit !== null && form.deposit >= form.price) {
      context.addIssue({
        code: "custom",
        path: ["deposit"],
        message:
          "The deposit must be less than the full price. Leave it empty if people pay in full.",
      });
    }
    if (Boolean(form.startDate) !== Boolean(form.startTime)) {
      context.addIssue({
        code: "custom",
        path: [form.startDate ? "startTime" : "startDate"],
        message:
          "Enter both the date and time this option starts, or leave both empty.",
      });
    }
    return {
      name: form.name,
      description: form.description,
      price_pence: form.price,
      deposit_pence: form.deposit,
      starts_at:
        form.startDate && form.startTime
          ? moment(form.startDate, form.startTime)
          : null,
      capacity: form.capacity,
      sort_order: form.sortOrder ?? 0,
      on_sale: form.onSale,
    };
  });

// ---------------------------------------------------------------------------
// Copying an event
// ---------------------------------------------------------------------------

export const COPY_FIELDS = ["title", "startDate"] as const;
export type CopyField = (typeof COPY_FIELDS)[number];

export const copyEventSchema = z.object({
  title: requiredText(120, "Enter a name for the new event"),
  startDate: requiredDate("Enter the date the new event starts"),
});

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export const VENUE_FIELDS = [
  "name",
  "address",
  "postcode",
  "phone",
  "mapUrl",
  "parking",
  "accessInfo",
] as const;
export type VenueField = (typeof VENUE_FIELDS)[number];

export const venueFormSchema = z
  .object({
    name: requiredText(120, "Enter the venue's name"),
    address: optionalText(500),
    postcode: optionalText(12).transform((value) => value.toUpperCase()),
    phone: optionalText(40),
    mapUrl: optionalWebAddress,
    parking: optionalText(1000),
    accessInfo: optionalText(1000),
  })
  .transform((form) => ({
    name: form.name,
    address: form.address,
    postcode: form.postcode,
    phone: form.phone,
    map_url: form.mapUrl,
    parking: form.parking,
    access_info: form.accessInfo,
  }));
