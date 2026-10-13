import { isIsoDate, ukToday } from "@/lib/dates";
import { monthAround } from "@/lib/reports/payments";

/** The report's dates from the address, or this month. */
export function reportDates(
  from: unknown,
  to: unknown,
): {
  from: string;
  to: string;
} {
  const month = monthAround(ukToday());
  const start = typeof from === "string" && isIsoDate(from) ? from : month.from;
  const end = typeof to === "string" && isIsoDate(to) ? to : month.to;
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
