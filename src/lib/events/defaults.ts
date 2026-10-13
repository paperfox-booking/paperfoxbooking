/**
 * Paper Fox's standard set-up for a new event (CLAUDE.md section 15). These
 * only fill in a new event's form: every event keeps its own copy, which the
 * team can change.
 */

export const STANDARD_EVENT = {
  startTime: "09:00",
  endTime: "17:00",
  capacity: 110,
  included: [
    "Your own 4ft crop table",
    "A welcome goody bag, challenges and activities",
    "Tea and coffee throughout",
    "A light lunch on Saturday and Sunday, and an evening meal on Saturday",
    "Free parking and wifi",
    "Use of the die-cutting tools, and access to the craft shops",
  ].join("\n"),
} as const;

export interface StandardOption {
  name: string;
  description: string;
  pricePence: number;
  depositPence: number;
  /** UK clock time on the event's first day. */
  startTime: string;
  sortOrder: number;
}

export const STANDARD_OPTIONS: readonly StandardOption[] = [
  {
    name: "Weekend (4pm start)",
    description: "Friday 4pm to Sunday 5pm.",
    pricePence: 19500,
    depositPence: 6000,
    startTime: "16:00",
    sortOrder: 1,
  },
  {
    name: "Friday Kick Starter (9am start)",
    description:
      "Friday 9am to Sunday 5pm. Adds an extra self-paced class kit, Friday lunch and refreshments, and early access to the shop.",
    pricePence: 24500,
    depositPence: 8500,
    startTime: "09:00",
    sortOrder: 2,
  },
];
