"use server";

import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { getDirectoryPerson, type DirectoryPerson } from "@/lib/bookings/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CUSTOMER_COLUMNS,
  PERSON_FIELDS,
  customerCellSchemas,
  isCustomerCell,
  personSchema,
  type PersonField,
} from "@/lib/validation/bookings";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

const NOT_ALLOWED =
  "You need to be signed in as an owner or admin to change people's details.";
const EMAIL_TAKEN =
  "Someone else already has that email address. Each person needs their own.";

export type PersonCellResult =
  { ok: true; person: DirectoryPerson } | { ok: false; error: string };

/** Saves one cell of the People list. */
export async function savePersonCellAction(
  customerId: string,
  field: string,
  value: string,
): Promise<PersonCellResult> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  if (!isCustomerCell(field)) {
    return { ok: false, error: "That can't be changed." };
  }
  const parsed = customerCellSchemas[field].safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check this",
    };
  }
  const supabase = await createSupabaseServerClient();
  // The column comes from CUSTOMER_COLUMNS and the value from its own check.
  const update = {
    [CUSTOMER_COLUMNS[field]]: parsed.data,
  } as TablesUpdate<"customers">;
  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customerId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505" ? EMAIL_TAKEN : friendlyDatabaseError(error),
    };
  }
  const person = await getDirectoryPerson(customerId);
  return person
    ? { ok: true, person }
    : { ok: false, error: "That person couldn't be found." };
}

export type PersonFormState = FormState<PersonField>;

/** Saves the form on someone's profile page. */
export async function savePersonAction(
  customerId: string,
  _previous: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const values = readForm(formData, PERSON_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = personSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("customers")
    .update(
      {
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        emergency_contact: parsed.data.emergencyContact,
        dietary_health: parsed.data.dietaryHealth,
        notes: parsed.data.notes,
        is_team: parsed.data.isTeam,
      },
      { count: "exact" },
    )
    .eq("id", customerId);
  if (error) {
    return {
      values,
      error:
        error.code === "23505" ? EMAIL_TAKEN : friendlyDatabaseError(error),
    };
  }
  if (count === 0) return { values, error: "That person couldn't be found." };
  redirect(`/admin/people/${customerId}?notice=saved`);
}
