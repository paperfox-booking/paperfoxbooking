import { toUkDateInput, toUkTimeInput } from "@/lib/dates";
import { penceToPoundsInput } from "@/lib/money";
import type { EventField, OptionField } from "@/lib/validation/events";
import { STANDARD_EVENT } from "./defaults";
import { DEFAULT_DEPOSIT_HOLD_DAYS } from "./rules";

/** Turns saved records into the strings the team's forms start with. */

export function newEventFormValues(
  venueId: string,
): Record<EventField, string> {
  return {
    title: "",
    summary: "",
    description: "",
    included: STANDARD_EVENT.included,
    hotelInfo: "",
    facebookGroupUrl: "",
    venueId,
    startDate: "",
    startTime: STANDARD_EVENT.startTime,
    endDate: "",
    endTime: STANDARD_EVENT.endTime,
    capacity: String(STANDARD_EVENT.capacity),
    balanceDueOn: "",
    depositHoldDays: String(DEFAULT_DEPOSIT_HOLD_DAYS),
    bookingOpensDate: "",
    bookingOpensTime: "",
    bookingClosesDate: "",
    bookingClosesTime: "",
  };
}

export function eventFormValues(event: {
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
}): Record<EventField, string> {
  return {
    title: event.title,
    summary: event.summary,
    description: event.description,
    included: event.included,
    hotelInfo: event.hotel_info,
    facebookGroupUrl: event.facebook_group_url ?? "",
    venueId: event.venue_id,
    startDate: toUkDateInput(event.starts_at),
    startTime: toUkTimeInput(event.starts_at),
    endDate: toUkDateInput(event.ends_at),
    endTime: toUkTimeInput(event.ends_at),
    capacity: String(event.capacity),
    balanceDueOn: event.balance_due_on,
    depositHoldDays: String(event.deposit_hold_days),
    bookingOpensDate: event.booking_opens_at
      ? toUkDateInput(event.booking_opens_at)
      : "",
    bookingOpensTime: event.booking_opens_at
      ? toUkTimeInput(event.booking_opens_at)
      : "",
    bookingClosesDate: event.booking_closes_at
      ? toUkDateInput(event.booking_closes_at)
      : "",
    bookingClosesTime: event.booking_closes_at
      ? toUkTimeInput(event.booking_closes_at)
      : "",
  };
}

export function optionFormValues(
  option: {
    name: string;
    description: string;
    price_pence: number;
    deposit_pence: number | null;
    starts_at: string | null;
    capacity: number | null;
    sort_order: number;
    on_sale: boolean;
  } | null,
  eventStartsAt: string,
): Record<OptionField, string> {
  if (!option) {
    return {
      name: "",
      description: "",
      price: "",
      deposit: "",
      startDate: toUkDateInput(eventStartsAt),
      startTime: "",
      capacity: "",
      sortOrder: "",
      onSale: "on",
    };
  }
  return {
    name: option.name,
    description: option.description,
    price: penceToPoundsInput(option.price_pence),
    deposit:
      option.deposit_pence === null
        ? ""
        : penceToPoundsInput(option.deposit_pence),
    startDate: option.starts_at ? toUkDateInput(option.starts_at) : "",
    startTime: option.starts_at ? toUkTimeInput(option.starts_at) : "",
    capacity: option.capacity === null ? "" : String(option.capacity),
    sortOrder: String(option.sort_order),
    onSale: option.on_sale ? "on" : "",
  };
}
