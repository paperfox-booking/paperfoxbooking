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

const fieldClasses =
  "block w-full rounded-lg border-2 border-stone bg-white px-3 text-base text-ink placeholder:text-stone focus-visible:border-coral-deep";

export function Textarea({
  className,
  "aria-invalid": ariaInvalid,
  rows = 4,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      aria-invalid={ariaInvalid}
      rows={rows}
      className={cn(
        fieldClasses,
        "py-2",
        ariaInvalid ? "border-danger" : null,
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      aria-invalid={ariaInvalid}
      className={cn(
        fieldClasses,
        "min-h-12",
        ariaInvalid ? "border-danger" : null,
        className,
      )}
      {...props}
    />
  );
}

/** A tick box with its label beside it, big enough to tap. */
export function Checkbox({
  id,
  label,
  hint,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-6 shrink-0 accent-coral-deep"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div>
        <label htmlFor={id} className="font-bold text-ink">
          {label}
        </label>
        {hint ? (
          <Hint id={`${id}-hint`} className="mt-0">
            {hint}
          </Hint>
        ) : null}
      </div>
    </div>
  );
}

/** A pound sign in front of a money input. */
export function MoneyInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <div className={cn("relative max-w-48", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-stone"
      >
        £
      </span>
      <Input type="text" inputMode="decimal" className="pl-7" {...props} />
    </div>
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
