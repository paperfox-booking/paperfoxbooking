import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Form building blocks. Every input has a visible label, and hints and errors
 * are linked to the input with aria-describedby so screen readers read them.
 * Inputs use a 16px font so phones don't zoom in when they're tapped.
 */

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-base font-bold text-ink", className)}
      {...props}
    />
  );
}

export function Input({
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      aria-invalid={ariaInvalid}
      className={cn(
        "block min-h-12 w-full rounded-lg border-2 border-stone bg-white px-3 text-base text-ink placeholder:text-stone",
        "focus-visible:border-coral-deep",
        ariaInvalid ? "border-danger" : null,
        className,
      )}
      {...props}
    />
  );
}

export function Hint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-base text-stone", className)} {...props} />;
}

export function FieldError({
  className,
  children,
  ...props
}: ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p className={cn("font-bold text-danger", className)} {...props}>
      <span className="sr-only">Error: </span>
      {children}
    </p>
  );
}

/** A label, optional hint and error, wrapped around one input. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** The aria-describedby value for an input inside <Field>. */
export function describedBy(
  id: string,
  { hint, error }: { hint?: unknown; error?: unknown },
): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}
