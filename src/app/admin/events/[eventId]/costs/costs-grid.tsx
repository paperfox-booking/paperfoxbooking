"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ReactNode } from "react";
import {
  FormSection,
  MoneyField,
  SelectField,
  TextField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { formatPrice, penceToPoundsInput } from "@/lib/money";
import type { CostRow } from "@/lib/reports/admin";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  isCostCategory,
} from "@/lib/reports/profit";
import type { CostCell } from "@/lib/validation/costs";
import { cn } from "@/lib/utils";
import {
  addCostAction,
  removeCostAction,
  saveCostCellAction,
  type NewCostState,
} from "./actions";

type Status = "saving" | "saved" | "error";

const cellInput =
  "block min-h-10 rounded-md border-2 border-transparent bg-transparent px-2 text-base text-ink hover:border-cream focus-visible:border-coral-deep focus-visible:bg-white aria-invalid:border-danger";

function label(category: string): string {
  return isCostCategory(category) ? COST_CATEGORY_LABELS[category] : category;
}

/**
 * An event's costs as a spreadsheet: type into a box and it saves when you
 * move on. New costs are added at the bottom.
 */
export function CostsGrid({
  eventId,
  initialCosts,
}: {
  eventId: string;
  initialCosts: CostRow[];
}) {
  const router = useRouter();
  const [costs, setCosts] = useState(initialCosts);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [newCost, addFormAction, adding] = useActionState(
    async (previous: NewCostState, formData: FormData) => {
      const result = await addCostAction(eventId, previous, formData);
      if (result.cost) {
        const added = result.cost;
        setCosts((current) => [...current, added]);
        router.refresh();
        setAnnouncement(
          `Added ${label(added.category).toLowerCase()}: ${formatPrice(added.amountPence)}.`,
        );
      }
      return result;
    },
    {},
  );
  const newErrors = newCost.fieldErrors ?? {};

  async function save(
    cost: CostRow,
    field: CostCell,
    name: string,
    value: string,
  ) {
    const key = `${cost.id}:${field}`;
    setStatus((current) => ({ ...current, [key]: "saving" }));
    const result = await saveCostCellAction(cost.id, field, value);
    if (result.ok) {
      setCosts((current) =>
        current.map((candidate) =>
          candidate.id === cost.id ? result.cost : candidate,
        ),
      );
      setErrors((current) => {
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
      setStatus((current) => ({ ...current, [key]: "saved" }));
      setAnnouncement(`Saved ${name.toLowerCase()}.`);
      // The totals above the list come from the server.
      router.refresh();
    } else {
      setErrors((current) => ({ ...current, [key]: result.error }));
      setStatus((current) => ({ ...current, [key]: "error" }));
      setAnnouncement(`Couldn't save ${name.toLowerCase()}: ${result.error}`);
    }
  }

  async function remove(cost: CostRow) {
    const result = await removeCostAction(cost.id);
    if (result.ok) {
      setCosts((current) =>
        current.filter((candidate) => candidate.id !== cost.id),
      );
      setAnnouncement(`Removed ${cost.description || label(cost.category)}.`);
    } else {
      setAnnouncement(`Couldn't remove it: ${result.error}`);
    }
  }

  const total = costs.reduce((sum, cost) => sum + cost.amountPence, 0);
  const paid = costs
    .filter((cost) => cost.paid)
    .reduce((sum, cost) => sum + cost.amountPence, 0);
  const errorList = Object.values(errors);

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="min-h-6 font-bold">
        {announcement}
      </p>
      {errorList.length ? (
        <Notice tone="error">
          <ul className="list-disc pl-5">
            {errorList.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div
        role="region"
        aria-label="Costs"
        tabIndex={0}
        className="relative max-w-full overflow-x-auto rounded-2xl border border-cream bg-white"
      >
        <table className="min-w-max border-collapse text-left">
          <caption className="sr-only">This event&apos;s costs</caption>
          <thead className="bg-cream-light">
            <tr>
              <Th>Type</Th>
              <Th>What for</Th>
              <Th>Supplier</Th>
              <Th numeric>Amount</Th>
              <Th>Paid</Th>
              <Th>Notes</Th>
              <Th>
                <span className="sr-only">Remove</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {costs.map((cost) => {
              const name = cost.description || label(cost.category);
              const text = (
                field: "description" | "supplier" | "notes",
                fieldLabel: string,
                value: string,
                width: string,
              ) => {
                const key = `${cost.id}:${field}`;
                return (
                  <input
                    key={`${key}:${value}`}
                    aria-label={`${fieldLabel} for ${name}`}
                    aria-invalid={errors[key] ? true : undefined}
                    defaultValue={value}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== value) {
                        void save(
                          cost,
                          field,
                          `${fieldLabel} for ${name}`,
                          event.currentTarget.value,
                        );
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className={cn(
                      cellInput,
                      width,
                      status[key] === "saving" && "border-dashed border-stone",
                    )}
                  />
                );
              };
              const amountKey = `${cost.id}:amount`;
              const amountValue = penceToPoundsInput(cost.amountPence);
              return (
                <tr key={cost.id} className="border-t border-cream align-top">
                  <td className="px-1 py-2">
                    <select
                      aria-label={`Type of cost for ${name}`}
                      defaultValue={cost.category}
                      key={`${cost.id}:category:${cost.category}`}
                      onChange={(event) =>
                        void save(
                          cost,
                          "category",
                          `Type of cost for ${name}`,
                          event.currentTarget.value,
                        )
                      }
                      className={cn(cellInput, "w-52")}
                    >
                      {COST_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {COST_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-2">
                    {text("description", "What for", cost.description, "w-64")}
                  </td>
                  <td className="px-1 py-2">
                    {text("supplier", "Supplier", cost.supplier, "w-48")}
                  </td>
                  <td className="px-1 py-2">
                    <div className="relative w-32">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-stone"
                      >
                        £
                      </span>
                      <input
                        key={`${amountKey}:${amountValue}`}
                        inputMode="decimal"
                        aria-label={`Amount for ${name}`}
                        aria-invalid={errors[amountKey] ? true : undefined}
                        defaultValue={amountValue}
                        onBlur={(event) => {
                          if (event.currentTarget.value !== amountValue) {
                            void save(
                              cost,
                              "amount",
                              `Amount for ${name}`,
                              event.currentTarget.value,
                            );
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        className={cn(
                          cellInput,
                          "w-32 pl-6 text-right",
                          status[amountKey] === "saving" &&
                            "border-dashed border-stone",
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`${name} has been paid`}
                      checked={cost.paid}
                      onChange={(event) =>
                        void save(
                          cost,
                          "paid",
                          `Paid for ${name}`,
                          String(event.currentTarget.checked),
                        )
                      }
                      className="mt-2 size-6 accent-coral-deep"
                    />
                  </td>
                  <td className="px-1 py-2">
                    {text("notes", "Notes", cost.notes, "w-64")}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="link"
                      size="small"
                      className="min-h-10 px-0"
                      onClick={() => void remove(cost)}
                    >
                      Remove<span className="sr-only"> {name}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {costs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6">
                  No costs yet. Add the first one below, for example room hire.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot className="border-t-2 border-cream bg-cream-light font-bold">
            <tr>
              <td className="px-2 py-3" colSpan={3}>
                Total ({formatPrice(paid)} paid, {formatPrice(total - paid)}{" "}
                still to pay)
              </td>
              <td className="px-2 py-3 text-right">{formatPrice(total)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <form action={addFormAction} noValidate>
        <FormSection title="Add a cost">
          {newCost.error ? <Notice tone="error">{newCost.error}</Notice> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="new-category"
              name="category"
              label="Type of cost"
              error={newErrors.category}
              defaultValue={newCost.values?.category ?? "venue"}
            >
              {COST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {COST_CATEGORY_LABELS[category]}
                </option>
              ))}
            </SelectField>
            <TextField
              id="new-description"
              name="description"
              label="What for (optional)"
              hint="For example, Main room hire for 3 days."
              error={newErrors.description}
              defaultValue={newCost.values?.description ?? ""}
              maxLength={200}
            />
            <TextField
              id="new-supplier"
              name="supplier"
              label="Supplier (optional)"
              error={newErrors.supplier}
              defaultValue={newCost.values?.supplier ?? ""}
              maxLength={120}
            />
            <MoneyField
              id="new-amount"
              name="amount"
              label="Amount"
              error={newErrors.amount}
              defaultValue={newCost.values?.amount ?? ""}
            />
          </div>
          <Checkbox id="new-paid" name="paid" label="Already paid" />
          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add cost"}
          </Button>
        </FormSection>
      </form>
    </div>
  );
}

function Th({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-2 py-3 font-bold whitespace-nowrap",
        numeric && "text-right",
      )}
    >
      {children}
    </th>
  );
}
