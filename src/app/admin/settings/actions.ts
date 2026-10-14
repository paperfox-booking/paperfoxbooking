"use server";

import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SETTINGS_FIELDS,
  settingsSchema,
  type SettingsField,
} from "@/lib/validation/settings";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

export type SettingsFormState = FormState<SettingsField>;

export async function saveSettingsAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const values = readForm(formData, SETTINGS_FIELDS);
  if (!(await staffWithPermission("settings.manage"))) {
    return { values, error: "Only owners can change the settings." };
  }
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      values,
      error: "Some details need changing. They're marked below.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("settings")
    .update(parsed.data, { count: "exact" })
    .eq("singleton", true);
  if (error) return { values, error: friendlyDatabaseError(error) };
  if (count === 0) {
    return { values, error: "Only owners can change the settings." };
  }
  redirect("/admin/settings?notice=saved");
}
