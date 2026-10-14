"use server";

import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { isTemplateKey } from "@/lib/email/booking-emails";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TEMPLATE_FIELDS,
  templateSchema,
  type TemplateField,
} from "@/lib/validation/settings";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

export type TemplateFormState = FormState<TemplateField>;

export async function saveTemplateAction(
  key: string,
  _previous: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const values = readForm(formData, TEMPLATE_FIELDS);
  if (!(await staffWithPermission("attendees.message"))) {
    return {
      values,
      error: "You need to be an owner or admin to change the emails.",
    };
  }
  if (!isTemplateKey(key))
    return { values, error: "That email doesn't exist." };
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("email_templates")
    .update(parsed.data, { count: "exact" })
    .eq("key", key);
  if (error) return { values, error: friendlyDatabaseError(error) };
  if (count === 0) {
    return {
      values,
      error: "You need to be an owner or admin to change the emails.",
    };
  }
  redirect(`/admin/emails/${key}?notice=saved#preview`);
}
