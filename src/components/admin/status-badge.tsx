import { STATUS_LABELS, type EventStatus } from "@/lib/events/rules";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: "border-stone bg-white",
  published: "border-teal-deep bg-teal",
  sold_out: "border-coral-deep bg-coral",
  cancelled: "border-danger bg-white text-danger",
  finished: "border-stone bg-cream",
};

/** An event's status, as a label (always with text, never colour alone). */
export function StatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 px-3 py-0.5 text-sm font-bold text-ink",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
