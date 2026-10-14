import { bookingMoney } from "@/lib/bookings/money";

/**
 * Who gets an email sent to everyone on an event. Safe to use in the
 * browser, so the list updates as the choices change.
 */

export const AUDIENCES = [
  "everyone",
  "owes",
  "overdue",
  "no_deposit",
  "not_had",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: "Everyone booked",
  owes: "Everyone who still owes money",
  overdue: "Only people whose balance is overdue",
  no_deposit: "Only people who haven't paid their deposit yet",
  not_had: "Only people who haven't had this email yet",
};

export interface AudiencePerson {
  bookingId: string;
  reference: string;
  fullName: string;
  email: string;
  isTeam: boolean;
  cancelled: boolean;
  pricePence: number;
  depositPence: number | null;
  paidPence: number;
  /** The standard emails they've already been sent (B1, B2…). */
  sentTemplates: string[];
}

export function pickAudience(
  people: readonly AudiencePerson[],
  audience: Audience,
  {
    template,
    includeTeam,
    balanceDueOn,
    today,
  }: {
    /** The standard email being sent, or null for a message of your own. */
    template: string | null;
    includeTeam: boolean;
    balanceDueOn: string;
    today: string;
  },
): AudiencePerson[] {
  return people.filter((person) => {
    if (person.cancelled) return false;
    if (person.isTeam && !includeTeam) return false;
    const money = bookingMoney(
      {
        pricePence: person.pricePence,
        depositPence: person.depositPence,
        paidPence: person.paidPence,
        cancelled: false,
        balanceDueOn,
      },
      today,
    );
    switch (audience) {
      case "everyone":
        return true;
      case "owes":
        return money.balancePence > 0;
      case "overdue":
        return money.overdue;
      case "no_deposit":
        return money.state === "unpaid" || money.state === "part_paid";
      case "not_had":
        return template ? !person.sentTemplates.includes(template) : true;
    }
  });
}
