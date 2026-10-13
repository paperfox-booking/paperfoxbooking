import { formatUkDate } from "@/lib/dates";
import type { PublicAvailability } from "@/lib/events/rules";
import { cn } from "@/lib/utils";

/** Whether an event can be booked, in words (never colour alone). */
export function availabilityText(availability: PublicAvailability): string {
  switch (availability.kind) {
    case "open":
      return "Booking open";
    case "not_open_yet":
      return `Booking opens ${formatUkDate(availability.opensAt)}`;
    case "closed":
      return "Booking closed";
    case "sold_out":
      return "Sold out";
    case "cancelled":
      return "Cancelled";
    case "finished":
      return "Finished";
  }
}

export function AvailabilityBadge({
  availability,
  className,
}: {
  availability: PublicAvailability;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 px-3 py-0.5 text-sm font-bold text-ink",
        availability.kind === "open"
          ? "border-teal-deep bg-teal"
          : availability.kind === "sold_out"
            ? "border-coral-deep bg-coral"
            : "border-stone bg-white",
        className,
      )}
    >
      {availabilityText(availability)}
    </span>
  );
}
