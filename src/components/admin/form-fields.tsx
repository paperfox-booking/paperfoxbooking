import type { ComponentProps, ReactNode } from "react";
import {
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
  describedBy,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Labelled fields for the team's forms. Each one is wired up for screen
 * readers (hint and error linked to the input) and keeps what was typed when
 * the form comes back with a problem. The input's id is its name, unless an
 * id is given (needed when a page has several forms with the same fields).
 */

interface FieldProps {
  name: string;
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  defaultValue?: string;
}

function a11y(name: string, hint: unknown, error: unknown) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy(name, { hint, error }),
  };
}

export function TextField({
  id,
  name,
  label,
  hint,
  error,
  defaultValue,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name" | "defaultValue" | "id">) {
  return (
    <Field id={id ?? name} label={label} hint={hint} error={error}>
      <Input
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        className={className}
        {...a11y(id ?? name, hint, error)}
        {...props}
      />
    </Field>
  );
}

export function TextareaField({
  id,
  name,
  label,
  hint,
  error,
  defaultValue,
  ...props
}: FieldProps &
  Omit<ComponentProps<"textarea">, "name" | "defaultValue" | "id">) {
  return (
    <Field id={id ?? name} label={label} hint={hint} error={error}>
      <Textarea
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        {...a11y(id ?? name, hint, error)}
        {...props}
      />
    </Field>
  );
}

export function MoneyField({
  id,
  name,
  label,
  hint,
  error,
  defaultValue,
  ...props
}: FieldProps &
  Omit<ComponentProps<"input">, "name" | "defaultValue" | "type" | "id">) {
  return (
    <Field id={id ?? name} label={label} hint={hint} error={error}>
      <MoneyInput
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        {...a11y(id ?? name, hint, error)}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  id,
  name,
  label,
  hint,
  error,
  defaultValue,
  children,
  ...props
}: FieldProps &
  Omit<ComponentProps<"select">, "name" | "defaultValue" | "id">) {
  return (
    <Field id={id ?? name} label={label} hint={hint} error={error}>
      <Select
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        {...a11y(id ?? name, hint, error)}
        {...props}
      >
        {children}
      </Select>
    </Field>
  );
}

/** A date and a time side by side, sharing one heading. */
export function DateTimeFields({
  legend,
  hint,
  date,
  time,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  date: FieldProps &
    Omit<ComponentProps<"input">, "name" | "defaultValue" | "id">;
  time: FieldProps &
    Omit<ComponentProps<"input">, "name" | "defaultValue" | "id">;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold">{legend}</legend>
      {hint ? <p className="text-base text-stone">{hint}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField type="date" className="max-w-56" {...date} />
        <TextField type="time" className="max-w-40" {...time} />
      </div>
    </fieldset>
  );
}

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "space-y-5 rounded-2xl border border-cream bg-white p-5 sm:p-6",
        className,
      )}
    >
      <legend className="float-left mb-1 w-full font-display text-3xl">
        {title}
      </legend>
      {description ? (
        <p className="clear-both text-base text-stone">{description}</p>
      ) : (
        <div className="clear-both" />
      )}
      {children}
    </fieldset>
  );
}
