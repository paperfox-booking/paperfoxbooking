"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Notice } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/form";
import type { DirectoryPerson } from "@/lib/bookings/admin";
import { comparePeople } from "@/lib/bookings/people";
import type { CustomerCell } from "@/lib/validation/bookings";
import { cn } from "@/lib/utils";
import { savePersonCellAction } from "./actions";

type Status = "saving" | "saved" | "error";

const COLUMNS: {
  field: Exclude<CustomerCell, "isTeam">;
  label: string;
  width: string;
  type?: string;
}[] = [
  { field: "fullName", label: "Name", width: "w-48" },
  { field: "email", label: "Email", width: "w-64", type: "email" },
  { field: "phone", label: "Mobile", width: "w-40", type: "tel" },
  { field: "emergencyContact", label: "Emergency contact", width: "w-64" },
  { field: "dietaryHealth", label: "Dietary and health", width: "w-64" },
  { field: "notes", label: "Notes", width: "w-64" },
];

/**
 * Everyone on file as a spreadsheet: type into a box and it saves when you
 * move on. Enter and the up and down arrows move between rows.
 */
export function DirectoryGrid({
  initialPeople,
  canEdit,
}: {
  initialPeople: DirectoryPerson[];
  canEdit: boolean;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [onlyTeam, setOnlyTeam] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const table = useRef<HTMLTableElement>(null);

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return people.filter(
      (person) =>
        (!onlyTeam || person.isTeam) &&
        (!words ||
          [person.fullName, person.email, person.phone, person.notes]
            .join(" ")
            .toLowerCase()
            .includes(words)),
    );
  }, [people, query, onlyTeam]);

  async function save(
    person: DirectoryPerson,
    field: CustomerCell,
    label: string,
    value: string,
  ) {
    const key = `${person.id}:${field}`;
    setStatus((current) => ({ ...current, [key]: "saving" }));
    const result = await savePersonCellAction(person.id, field, value);
    if (result.ok) {
      setPeople((current) =>
        current
          .map((candidate) =>
            candidate.id === person.id ? result.person : candidate,
          )
          .sort(comparePeople),
      );
      setErrors((current) => {
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
      setStatus((current) => ({ ...current, [key]: "saved" }));
      setAnnouncement(
        `Saved ${label.toLowerCase()} for ${result.person.fullName}.`,
      );
    } else {
      setErrors((current) => ({ ...current, [key]: result.error }));
      setStatus((current) => ({ ...current, [key]: "error" }));
      setAnnouncement(
        `Couldn't save ${label.toLowerCase()} for ${person.fullName}: ${result.error}`,
      );
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type === "checkbox")
      return;
    const rowIndex = Number(target.dataset.row);
    const column = target.dataset.col;
    if (Number.isNaN(rowIndex) || !column) return;
    let next = rowIndex;
    if (event.key === "Enter" || event.key === "ArrowDown") next += 1;
    else if (event.key === "ArrowUp") next -= 1;
    else if (event.key === "Escape") {
      target.value = target.defaultValue;
      return;
    } else return;
    event.preventDefault();
    const nextInput = table.current?.querySelector<HTMLInputElement>(
      `input[data-row="${next}"][data-col="${column}"]`,
    );
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    } else {
      target.blur();
    }
  }

  const errorList = Object.entries(errors);

  return (
    <div className="space-y-4">
      <div
        role="search"
        className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-cream bg-white p-4"
      >
        <div className="w-full max-w-sm">
          <label htmlFor="find-person" className="block font-bold">
            Find someone
          </label>
          <Input
            id="find-person"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Name, email, mobile or notes"
          />
        </div>
        <Checkbox
          id="only-team"
          label="Only the team"
          checked={onlyTeam}
          onChange={(event) => setOnlyTeam(event.currentTarget.checked)}
        />
      </div>

      <p role="status" aria-live="polite" className="min-h-6 font-bold">
        {announcement}
      </p>
      {errorList.length ? (
        <Notice tone="error">
          <p className="font-bold">Some changes weren&apos;t saved:</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([key, message]) => {
              const person = people.find((candidate) =>
                key.startsWith(candidate.id),
              );
              return (
                <li key={key}>
                  {person?.fullName ?? "Someone"}: {message}
                </li>
              );
            })}
          </ul>
        </Notice>
      ) : null}

      <p>
        Showing {visible.length} of {people.length}{" "}
        {people.length === 1 ? "person" : "people"}.
        {canEdit
          ? " Type into a box to change it: it saves when you move on. Enter and the up and down arrows move between rows."
          : null}
      </p>

      <div
        role="region"
        aria-label="Everyone on file"
        tabIndex={0}
        className="relative max-w-full overflow-x-auto rounded-2xl border border-cream bg-white"
      >
        <table
          ref={table}
          onKeyDown={onKeyDown}
          className="min-w-max border-collapse text-left"
        >
          <caption className="sr-only">
            Everyone on file, the team first and then by name
          </caption>
          <thead className="bg-cream-light">
            <tr>
              {COLUMNS.map((column, index) => (
                <th
                  key={column.field}
                  scope="col"
                  className={cn(
                    "px-2 py-3 font-bold whitespace-nowrap",
                    index === 0 &&
                      "sticky left-0 z-20 border-r border-cream bg-cream-light",
                  )}
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="px-2 py-3 font-bold">
                Team
              </th>
              <th scope="col" className="px-2 py-3 font-bold">
                Events
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person, rowIndex) => (
              <tr key={person.id} className="border-t border-cream align-top">
                {COLUMNS.map((column, index) => {
                  const key = `${person.id}:${column.field}`;
                  const value = person[column.field];
                  return (
                    <td
                      key={column.field}
                      className={cn(
                        "px-1 py-2",
                        index === 0 &&
                          "sticky left-0 z-10 border-r border-cream bg-white px-2",
                      )}
                    >
                      {canEdit ? (
                        <input
                          key={`${key}:${value}`}
                          data-row={rowIndex}
                          data-col={column.field}
                          type={column.type ?? "text"}
                          aria-label={`${column.label} for ${person.fullName}`}
                          aria-invalid={errors[key] ? true : undefined}
                          title={value || undefined}
                          defaultValue={value}
                          spellCheck={
                            column.field === "email" ? false : undefined
                          }
                          onBlur={(event) => {
                            if (event.currentTarget.value !== value) {
                              void save(
                                person,
                                column.field,
                                column.label,
                                event.currentTarget.value,
                              );
                            }
                          }}
                          className={cn(
                            "block min-h-10 rounded-md border-2 border-transparent bg-transparent px-2 text-base text-ink hover:border-cream focus-visible:border-coral-deep focus-visible:bg-white aria-invalid:border-danger",
                            column.width,
                            status[key] === "saving" &&
                              "border-dashed border-stone",
                          )}
                        />
                      ) : (
                        <span className={cn("block px-2 pt-2", column.width)}>
                          {value}
                        </span>
                      )}
                      {index === 0 ? (
                        <Link
                          href={`/admin/people/${person.id}`}
                          className="mt-1 block px-2 text-sm"
                        >
                          Profile
                          <span className="sr-only">
                            {" "}
                            for {person.fullName}
                          </span>
                        </Link>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 py-2">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      aria-label={`${person.fullName} is on the team`}
                      checked={person.isTeam}
                      onChange={(event) =>
                        void save(
                          person,
                          "isTeam",
                          "Team",
                          String(event.currentTarget.checked),
                        )
                      }
                      className="mt-2 size-6 accent-coral-deep"
                    />
                  ) : person.isTeam ? (
                    "Yes"
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <span className="block w-56 pt-2 text-sm">
                    {person.events.length
                      ? person.events.map((event) => event.title).join(", ")
                      : "None yet"}
                  </span>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6">
                  {people.length === 0
                    ? "Nobody is on file yet. People are added when they're booked onto an event, or when a spreadsheet is imported."
                    : "Nobody matches. Try a different search."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
