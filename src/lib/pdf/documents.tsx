import "server-only";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  formatUkDateRange,
  formatUkFriendlyTime,
  formatUkLongDate,
} from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import {
  bankDetails,
  placeholderValues,
  type EmailBooking,
  type EmailEvent,
  type EmailOption,
  type EmailSettings,
} from "@/lib/email/values";
import { BEBAS_NEUE_WOFF, FOX_MARK_PNG } from "./assets";

/**
 * The documents attached to emails, made from each event's own details so
 * they can't go out of date (like a March confirmation linking to
 * November's Facebook group):
 *   - booking details: prices, how to pay, key dates, the venue and hotel;
 *   - confirmation: their place, what's included, the Facebook group;
 *   - terms and conditions: the current version from Settings.
 */

Font.register({ family: "Bebas Neue", src: BEBAS_NEUE_WOFF });
// Never split words across lines.
Font.registerHyphenationCallback((word) => [word]);

export const DOCUMENT_KINDS = [
  "booking-details",
  "confirmation",
  "terms",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_TITLES: Record<DocumentKind, string> = {
  "booking-details": "Booking details",
  confirmation: "Confirmation",
  terms: "Terms and conditions",
};

export interface DocumentOption extends EmailOption {
  description: string;
  startsAt: string | null;
}

export interface DocumentEvent extends EmailEvent {
  options: DocumentOption[];
  included: string;
  hotelInfo: string;
  venueAddress: string;
  venuePostcode: string;
  venuePhone: string;
  venueParking: string;
  venueAccess: string;
}

export interface DocumentData {
  settings: EmailSettings;
  event: DocumentEvent;
  /** Empty for a blank copy, such as the preview on an event's page. */
  booking: EmailBooking | null;
  today: string;
}

const INK = "#221e1f";
const TEAL = "#93ded0";
const CREAM = "#e8e2da";
const CORAL_DEEP = "#b82c14";
const STONE = "#6f6466";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: INK,
  },
  band: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  logo: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  brand: {
    fontFamily: "Bebas Neue",
    fontSize: 26,
    lineHeight: 1,
    letterSpacing: 1,
    marginBottom: 4,
  },
  bandTitle: { fontSize: 11, lineHeight: 1.2 },
  title: {
    fontFamily: "Bebas Neue",
    fontSize: 30,
    lineHeight: 1,
    marginBottom: 6,
  },
  subtitle: { fontSize: 12, marginBottom: 14 },
  heading: {
    fontFamily: "Bebas Neue",
    fontSize: 18,
    lineHeight: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: { marginBottom: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  box: {
    backgroundColor: CREAM,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: CREAM,
    paddingVertical: 4,
  },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 3,
  },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  link: { color: CORAL_DEEP },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    fontSize: 8.5,
    color: STONE,
  },
});

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <View>
      {text
        .split(/\r?\n\s*\r?\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, index) => (
          <Text key={index} style={styles.paragraph}>
            {block}
          </Text>
        ))}
    </View>
  );
}

function Shell({
  title,
  event,
  settings,
  children,
}: {
  title: string;
  event: DocumentEvent | null;
  settings: EmailSettings;
  children: ReactNode;
}) {
  const company = [
    settings.legalName,
    settings.companyNumber && `Company number ${settings.companyNumber}`,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <Document
      title={event ? `${title}: ${event.title}` : title}
      author={settings.businessName}
      language="en-GB"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt text */}
          <Image src={FOX_MARK_PNG} style={styles.logo} />
          <View>
            <Text style={styles.brand}>
              {settings.businessName.toUpperCase()}
            </Text>
            <Text style={styles.bandTitle}>{title}</Text>
          </View>
        </View>
        {event ? (
          <View>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.subtitle}>
              {formatUkDateRange(event.startsAt, event.endsAt)}, at{" "}
              {event.venueName}
            </Text>
          </View>
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
        {children}
        <Text style={styles.footer} fixed>
          {company}. {settings.contactEmail}. {settings.phone}
        </Text>
      </Page>
    </Document>
  );
}

/** "Starts Friday 19 March 2027 at 4pm". */
function optionStart(option: DocumentOption | undefined): string {
  return option?.startsAt
    ? `Starts ${formatUkLongDate(option.startsAt)} at ${formatUkFriendlyTime(option.startsAt)}`
    : "";
}

function Venue({ event }: { event: DocumentEvent }) {
  return (
    <View wrap={false}>
      <Text style={styles.heading} minPresenceAhead={36}>
        The venue
      </Text>
      <Text style={styles.bold}>{event.venueName}</Text>
      {lines([event.venueAddress, event.venuePostcode].join("\n")).map(
        (line, index) => (
          <Text key={index}>{line}</Text>
        ),
      )}
      {event.venuePhone ? <Text>Phone: {event.venuePhone}</Text> : null}
      {event.venueParking ? (
        <Text style={{ marginTop: 4 }}>Parking: {event.venueParking}</Text>
      ) : null}
      {event.venueAccess ? <Text>Access: {event.venueAccess}</Text> : null}
    </View>
  );
}

function Included({ event }: { event: DocumentEvent }) {
  const items = lines(event.included);
  if (!items.length) return null;
  return (
    <View>
      <Text style={styles.heading} minPresenceAhead={36}>
        What&apos;s included
      </Text>
      <Bullets items={items} />
    </View>
  );
}

function Hotel({ event }: { event: DocumentEvent }) {
  if (!event.hotelInfo.trim()) return null;
  return (
    <View>
      <Text style={styles.heading} minPresenceAhead={36}>
        Hotel rooms
      </Text>
      <Paragraphs text={event.hotelInfo} />
    </View>
  );
}

export function BookingDetailsDocument({
  settings,
  event,
  booking,
  today,
}: DocumentData) {
  const options = event.options.filter(
    (option) => option.onSale && option.pricePence > 0,
  );
  const values = booking
    ? placeholderValues({ settings, event, booking, payment: null, today })
    : null;
  const bank = bankDetails(
    settings,
    booking?.reference ?? "your booking reference",
  );
  return (
    <Shell title="Booking details" event={event} settings={settings}>
      {booking && values ? (
        <View style={styles.box}>
          <Text>
            For <Text style={styles.bold}>{values.full_name}</Text>, booking
            reference <Text style={styles.bold}>{booking.reference}</Text>
          </Text>
          {booking.optionName ? (
            <Text>
              {booking.optionName}: {values.total}
              {booking.depositPence ? `, deposit ${values.deposit}` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.heading} minPresenceAhead={36}>
        Prices
      </Text>
      <View style={styles.headRow}>
        <Text style={[styles.bold, { flex: 3 }]}>Option</Text>
        <Text style={[styles.bold, { flex: 1, textAlign: "right" }]}>
          Price
        </Text>
        <Text style={[styles.bold, { flex: 1, textAlign: "right" }]}>
          Deposit
        </Text>
      </View>
      {options.map((option) => (
        <View key={option.name} style={styles.row} wrap={false}>
          <View style={{ flex: 3, paddingRight: 8 }}>
            <Text style={styles.bold}>{option.name}</Text>
            {option.description ? <Text>{option.description}</Text> : null}
          </View>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {formatPrice(option.pricePence)}
          </Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {option.depositPence ? formatPrice(option.depositPence) : "None"}
          </Text>
        </View>
      ))}

      <Text style={styles.heading} minPresenceAhead={36}>
        Key dates
      </Text>
      <Bullets
        items={[
          values
            ? `Your place is held until ${values.deposit_due_by}. Pay your deposit (or in full) by then to secure it.`
            : `Your place is held for ${event.depositHoldDays} days after you book. Pay your deposit (or in full) by then to secure it.`,
          `The balance is due by ${values?.balance_due_on ?? placeholderBalanceDue(event)}. If you book after that date, please pay in full.`,
          "Deposits are non-refundable. Please read the terms and conditions.",
        ]}
      />

      <View wrap={false}>
        <Text style={styles.heading} minPresenceAhead={36}>
          How to pay
        </Text>
        {bank ? (
          <View style={styles.box}>
            {bank.split("\n").map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>
        ) : (
          <Text style={styles.paragraph}>
            Please contact us for our bank details.
          </Text>
        )}
        <Text style={styles.paragraph}>
          Please pay by bank transfer, using your booking reference as the
          payment reference so we can match your payment. We&apos;ll email to
          confirm when it arrives.
        </Text>
      </View>

      <Included event={event} />
      <Venue event={event} />
      <Hotel event={event} />

      <Text style={styles.heading} minPresenceAhead={36}>
        Any questions?
      </Text>
      <Text>
        Email {settings.contactEmail} or call {settings.phone}.
      </Text>
    </Shell>
  );
}

function placeholderBalanceDue(event: DocumentEvent): string {
  return formatUkLongDate(`${event.balanceDueOn}T12:00:00Z`);
}

export function ConfirmationDocument({
  settings,
  event,
  booking,
  today,
}: DocumentData) {
  const values = booking
    ? placeholderValues({ settings, event, booking, payment: null, today })
    : null;
  const option = event.options.find(
    (candidate) => candidate.name === booking?.optionName,
  );
  const owes = booking ? booking.pricePence - booking.paidPence : 0;
  return (
    <Shell title="Confirmation" event={event} settings={settings}>
      <View style={styles.box}>
        <Text style={[styles.bold, { fontSize: 12 }]}>
          {values
            ? `${values.full_name}, your place is confirmed.`
            : "Your place is confirmed."}
        </Text>
        {booking ? <Text>Booking reference: {booking.reference}</Text> : null}
        {booking?.optionName ? (
          <Text>
            {[booking.optionName, optionStart(option)]
              .filter(Boolean)
              .join(". ")}
          </Text>
        ) : null}
        {values ? (
          owes > 0 ? (
            <Text>
              You&apos;ve paid {values.paid} of {values.total}. Your balance of{" "}
              {values.balance} is due by {values.balance_due_on}.
            </Text>
          ) : (
            <Text>You&apos;ve paid in full: {values.total}. Thank you.</Text>
          )
        ) : null}
      </View>

      {event.facebookGroupUrl ? (
        <View>
          <Text style={styles.heading} minPresenceAhead={36}>
            The event&apos;s Facebook group
          </Text>
          <Text style={styles.paragraph}>
            Join our private Facebook group for this event, to chat with
            everyone else going and hear the latest news:
          </Text>
          <Link src={event.facebookGroupUrl} style={styles.link}>
            {event.facebookGroupUrl}
          </Link>
          <Text style={[styles.paragraph, { marginTop: 4 }]}>
            Not on Facebook? Don&apos;t worry: everything important comes by
            email too.
          </Text>
        </View>
      ) : null}

      <Included event={event} />
      <Venue event={event} />
      <Hotel event={event} />

      <Text style={styles.heading} minPresenceAhead={36}>
        Before the event
      </Text>
      <Bullets
        items={[
          "About four weeks before, we'll email about optional self-paced class kits, which you can buy before they go on general sale.",
          "A few days before, we'll email everything you need to know: arrival, the timetable, local amenities and FAQs.",
          `Any questions? Email ${settings.contactEmail} or call ${settings.phone}.`,
        ]}
      />
    </Shell>
  );
}

/** The terms: "## " starts a heading, "- " a bullet, blank lines paragraphs. */
export function TermsDocument({ settings }: { settings: EmailSettings }) {
  const blocks = settings.termsText
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <Shell title="Terms and conditions" event={null} settings={settings}>
      <Text style={[styles.paragraph, { color: STONE }]}>
        Version {settings.termsVersion}.
      </Text>
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <Text key={index} style={styles.heading} minPresenceAhead={40}>
              {block.slice(3)}
            </Text>
          );
        }
        if (block.split("\n").every((line) => /^\s*- /.test(line))) {
          return <Bullets key={index} items={lines(block)} />;
        }
        return (
          <Text key={index} style={styles.paragraph}>
            {block}
          </Text>
        );
      })}
    </Shell>
  );
}

/** Makes one of the documents as a PDF file. */
export async function renderDocument(
  kind: DocumentKind,
  data: DocumentData,
): Promise<Buffer> {
  switch (kind) {
    case "booking-details":
      return renderToBuffer(<BookingDetailsDocument {...data} />);
    case "confirmation":
      return renderToBuffer(<ConfirmationDocument {...data} />);
    case "terms":
      return renderToBuffer(<TermsDocument settings={data.settings} />);
  }
}

/** The file name for an attachment, for example "Booking details - Crop Weekend March 2027.pdf". */
export function documentFileName(
  kind: DocumentKind,
  eventTitle: string,
): string {
  const safeTitle = eventTitle.replace(/[^\p{L}\p{N} .,()-]/gu, "").trim();
  return kind === "terms"
    ? "Paper Fox terms and conditions.pdf"
    : `${DOCUMENT_TITLES[kind]} - ${safeTitle}.pdf`;
}
