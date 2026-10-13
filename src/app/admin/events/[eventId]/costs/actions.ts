"use server";

import { staffWithPermission } from "@/lib/auth/session";
import { getCost, type CostRow } from "@/lib/reports/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  COST_COLUMNS,
  NEW_COST_FIELDS,
  costCellSchemas,
  isCostCell,
  newCostSchema,
  type NewCostField,
} from "@/lib/validation/costs";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

/** Adding, changing and removing an event's costs, a cell at a time. */

const NOT_ALLOWED =
  "You need to be signed in as an owner or admin to change costs.";

export type CostResult =
  { ok: true; cost: CostRow } | { ok: false; error: string };

export async function saveCostCellAction(
  costId: string,
  field: string,
  value: string,
): Promise<CostResult> {
  if (!(await staffWithPermission("events.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  if (!isCostCell(field)) return { ok: false, error: "That can't be changed." };
  const parsed = costCellSchemas[field].safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check this",
    };
  }
  const supabase = await createSupabaseServerClient();
  // The column comes from COST_COLUMNS and the value from its own check.
  const update = {
    [COST_COLUMNS[field]]: parsed.data,
  } as TablesUpdate<"event_costs">;
  const { error } = await supabase
    .from("event_costs")
    .update(update)
    .eq("id", costId);
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  const cost = await getCost(costId);
  return cost
    ? { ok: true, cost }
    : { ok: false, error: "That cost couldn't be found." };
}

export type NewCostState = FormState<NewCostField> & { cost?: CostRow };

export async function addCostAction(
  eventId: string,
  _previous: NewCostState,
  formData: FormData,
): Promise<NewCostState> {
  const values = readForm(formData, NEW_COST_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = newCostSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("event_costs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  const { data, error } = await supabase
    .from("event_costs")
    .insert({
      event_id: eventId,
      category: parsed.data.category,
      description: parsed.data.description,
      supplier: parsed.data.supplier,
      amount_pence: parsed.data.amount,
      paid: parsed.data.paid,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error) return { values, error: friendlyDatabaseError(error) };
  const cost = await getCost(data.id);
  return cost ? { cost } : { error: "Added, but refresh the page to see it." };
}

export async function removeCostAction(costId: string): Promise<CostResult> {
  if (!(await staffWithPermission("events.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const cost = await getCost(costId);
  if (!cost) return { ok: false, error: "That cost has already been removed." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("event_costs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", costId);
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  return { ok: true, cost };
}
