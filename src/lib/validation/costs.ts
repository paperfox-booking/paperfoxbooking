import { z } from "zod";
import { COST_CATEGORIES } from "@/lib/reports/profit";
import { checkbox, optionalText, requiredPounds } from "./form";

/** The checks for an event's costs: one cell at a time, or a new row. */

export const COST_CELLS = [
  "category",
  "description",
  "supplier",
  "amount",
  "paid",
  "notes",
] as const;
export type CostCell = (typeof COST_CELLS)[number];

export function isCostCell(value: unknown): value is CostCell {
  return (
    typeof value === "string" &&
    (COST_CELLS as readonly string[]).includes(value)
  );
}

const category = z.enum(COST_CATEGORIES, { error: "Choose a type of cost" });
const amount = requiredPounds("Enter the amount, like 4500");

export const costCellSchemas = {
  category,
  description: optionalText(200),
  supplier: optionalText(120),
  amount,
  paid: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: optionalText(500),
} satisfies Record<CostCell, z.ZodType>;

export const COST_COLUMNS: Record<CostCell, string> = {
  category: "category",
  description: "description",
  supplier: "supplier",
  amount: "amount_pence",
  paid: "paid",
  notes: "notes",
};

export const NEW_COST_FIELDS = [
  "category",
  "description",
  "supplier",
  "amount",
  "paid",
] as const;
export type NewCostField = (typeof NEW_COST_FIELDS)[number];

export const newCostSchema = z.object({
  category,
  description: optionalText(200),
  supplier: optionalText(120),
  amount,
  paid: checkbox,
});
