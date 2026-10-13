import { bookingMoney } from "@/lib/bookings/money";
import {
  addDays,
  formatUkDateRange,
  formatUkLongDate,
  toUkDateInput,
} from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import type { PlaceholderValues } from "./placeholders";
import type { EmailBusiness } from "./layout";

/**
 * Everything an email about one booking can say, worked out in one place so
 * the emails, the PDFs and the previews always agree.
 */

export interface EmailSettings extends EmailBusiness {
  bankName: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  contactEmail: string;
  phone: string;
  emailReplyTo: string;
  emailTestAddress: string;
  sendPaymentEmails: boolean;
  termsText: string;
  termsVersion: number;
}

export interface EmailOption {
  name: string;
  pricePence: number;
  depositPence: number | null;
  onSale: boolean;
}

export interface EmailEvent {
  title: string;
  startsAt: string;
  endsAt: string;
  balanceDueOn: string;
  depositHoldDays: number;
  facebookGroupUrl: string | null;
  venueName: string;
  options: EmailOption[];
}

export interface EmailBooking {
  reference: string;
  fullName: string;
  optionName: string;
  pricePence: number;
  depositPence: number | null;
  paidPence: number;
  cancelled: boolean;
  /** When the booking was made. */
  createdAt: string;
}

export interface EmailPayment {
  amountPence: number;
  /** "YYYY-MM-DD", or null for an imported total. */
  receivedOn: string | null;
}

/** The first word of a name, for "Hello Jo". */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** "a £60" but "an £85" (eighty) or "an £11" (eleven). */
export function withArticle(price: string): string {
  const pounds = (price.split(".")[0] ?? "").replace(/\D/g, "");
  const vowelSound =
    pounds.startsWith("8") ||
    (pounds.length % 3 === 2 && /^1[18]/.test(pounds));
  return `${vowelSound ? "an" : "a"} ${price}`;
}

/** The event's options as a list: "- Weekend (4pm start): £195, with a £60 deposit". */
export function priceList(options: readonly EmailOption[]): string {
  return options
    .filter((option) => option.onSale && option.pricePence > 0)
    .map((option) =>
      option.depositPence
        ? `- ${option.name}: ${formatPrice(option.pricePence)}, with ${withArticle(formatPrice(option.depositPence))} deposit`
        : `- ${option.name}: ${formatPrice(option.pricePence)}`,
    )
    .join("\n");
}

/** Paper Fox's bank details, with the reference to use. Empty until they're added in settings. */
export function bankDetails(
  settings: EmailSettings,
  reference: string,
): string {
  if (!settings.bankSortCode || !settings.bankAccountNumber) return "";
  return [
    settings.bankName && `Bank: ${settings.bankName}`,
    `Account name: ${settings.bankAccountName || settings.legalName}`,
    `Sort code: ${settings.bankSortCode}`,
    `Account number: ${settings.bankAccountNumber}`,
    `Reference: ${reference}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The date a new booking's place is held until, if the deposit hasn't arrived. */
export function depositDueBy(event: EmailEvent, booking: EmailBooking): string {
  return addDays(toUkDateInput(booking.createdAt), event.depositHoldDays);
}

function longDate(isoDate: string): string {
  // Midday, so the date is the same whatever the clocks are doing.
  return formatUkLongDate(`${isoDate}T12:00:00Z`);
}

export function placeholderValues({
  settings,
  event,
  booking,
  payment,
  today,
}: {
  settings: EmailSettings;
  event: EmailEvent;
  booking: EmailBooking;
  payment: EmailPayment | null;
  today: string;
}): PlaceholderValues {
  const money = bookingMoney(
    {
      pricePence: booking.pricePence,
      depositPence: booking.depositPence,
      paidPence: booking.paidPence,
      cancelled: booking.cancelled,
      balanceDueOn: event.balanceDueOn,
    },
    today,
  );
  return {
    first_name: firstName(booking.fullName),
    full_name: booking.fullName.trim(),
    reference: booking.reference,
    event: event.title,
    event_dates: formatUkDateRange(event.startsAt, event.endsAt),
    venue: event.venueName,
    option: booking.optionName,
    prices: priceList(event.options),
    total: formatPrice(booking.pricePence),
    deposit: booking.depositPence ? formatPrice(booking.depositPence) : "",
    paid: formatPrice(booking.paidPence),
    balance: formatPrice(Math.max(money.balancePence, 0)),
    deposit_due_by: longDate(depositDueBy(event, booking)),
    balance_due_on: longDate(event.balanceDueOn),
    amount_received: payment ? formatPrice(payment.amountPence) : "",
    received_on: payment?.receivedOn ? longDate(payment.receivedOn) : "",
    bank_details: bankDetails(settings, booking.reference),
    facebook_group: event.facebookGroupUrl ?? "",
    sign_off: settings.signOff,
  };
}
