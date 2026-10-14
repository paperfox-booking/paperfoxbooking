"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  quickPaymentAction,
  saveCellAction,
} from "@/app/admin/bookings/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/form";
import { comparePeople, type PersonRow } from "@/lib/bookings/people";
import { bookingMoney, type BookingMoney } from "@/lib/bookings/money";
import { formatUkDate } from "@/lib/dates";
import { formatPrice, penceToPoundsInput } from "@/lib/money";
import type { Cell } from "@/lib/validation/bookings";
import { cn } from "@/lib/utils";
import { AddPersonForm } from "./add-person-form";
import { PaymentDialog } from "./payment-dialog";

export interface GridOption {
  id: string;
  name: string;
}

export interface GridRoom {
  id: string;
  name: string;
  capacity: number | null;
}

export interface KnownPersonChoice {
  fullName: string;
  email: string;
}

type Status = "saving" | "saved" | "error";

const TEMPLATE_SHORT: Record<string, string> = {
  B1: "B1",
  B2: "B2",
  B3: "B3",
  thanks: "Thanks",
  balance_reminder: "Reminder",
  class_kits: "Class kits",
  joining: "Joining",
  cancelled: "Cancelled",
  refund: "Refund",
  other: "Other",
};

/**
 * The spreadsheet-style screen: one row per person booked on an event, typed
 * into directly. Each cell saves when you leave it (or press Enter), and
 * Enter or the up and down arrows move between rows, like a spreadsheet.
 */
export function PeopleGrid({
  eventId,
  initialRows,
  options,
  rooms,
  knownPeople,
  canEdit,
  canSeeMoney,
  balanceDueOn,
  capacity,
  today,
}: {
  eventId: string;
  initialRows: PersonRow[];
  options: GridOption[];
  rooms: GridRoom[];
  knownPeople: KnownPersonChoice[];
  canEdit: boolean;
  canSeeMoney: boolean;
  balanceDueOn: string;
  capacity: number;
  today: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [query, setQuery] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [paying, setPaying] = useState<PersonRow | null>(null);
  const table = useRef<HTMLTableElement>(null);

  const moneyOf = (row: PersonRow): BookingMoney =>
    bookingMoney(
      {
        pricePence: row.pricePence,
        depositPence: row.depositPence,
        paidPence: row.paidPence,
        cancelled: row.cancelled,
        balanceDueOn,
      },
      today,
    );

  const active = rows.filter((row) => !row.cancelled);
  const cancelledCount = rows.length - active.length;
  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.cancelled && !showCancelled) return false;
      const money = bookingMoney(
        {
          pricePence: row.pricePence,
          depositPence: row.depositPence,
          paidPence: row.paidPence,
          cancelled: row.cancelled,
          balanceDueOn,
        },
        today,
      );
      if (onlyOwing && money.balancePence <= 0) return false;
      if (onlyOverdue && !money.overdue) return false;
      if (!words) return true;
      return [row.fullName, row.email, row.reference, row.notes, row.phone]
        .join(" ")
        .toLowerCase()
        .includes(words);
    });
  }, [rows, query, onlyOwing, onlyOverdue, showCancelled, balanceDueOn, today]);

  function replaceRow(updated: PersonRow) {
    setRows((current) =>
      current
        .map((row) => (row.bookingId === updated.bookingId ? updated : row))
        // Someone's name or team place may have changed their position.
        .sort(comparePeople),
    );
  }

  async function save(
    row: PersonRow,
    field: Cell,
    label: string,
    value: string,
  ) {
    const key = `${row.bookingId}:${field}`;
    setStatus((current) => ({ ...current, [key]: "saving" }));
    const result = await saveCellAction(row.bookingId, field, value);
    if (result.ok) {
      replaceRow(result.row);
      setErrors((current) => {
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
      setStatus((current) => ({ ...current, [key]: "saved" }));
      setAnnouncement(
        `Saved ${label.toLowerCase()} for ${result.row.fullName}.`,
      );
    } else {
      setErrors((current) => ({ ...current, [key]: result.error }));
      setStatus((current) => ({ ...current, [key]: "error" }));
      setAnnouncement(
        `Couldn't save ${label.toLowerCase()} for ${row.fullName}: ${result.error}`,
      );
    }
  }

  /** The Pay box: a bank transfer received today, recorded on Enter. */
  async function quickPay(row: PersonRow, input: HTMLInputElement) {
    const amount = input.value.trim();
    if (!amount) return;
    const key = `${row.bookingId}:pay`;
    setStatus((current) => ({ ...current, [key]: "saving" }));
    const result = await quickPaymentAction(row.bookingId, amount);
    if (result.ok) {
      input.value = "";
      replaceRow(result.row);
      setErrors((current) => {
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
      setStatus((current) => ({ ...current, [key]: "saved" }));
      setAnnouncement(
        `Recorded ${amount.startsWith("£") ? amount : `£${amount}`} from ${result.row.fullName}. They've now paid ${formatPrice(result.row.paidPence)}.${result.emailNote ? ` ${result.emailNote}` : ""}`,
      );
    } else {
      setErrors((current) => ({ ...current, [key]: result.error }));
      setStatus((current) => ({ ...current, [key]: "error" }));
      setAnnouncement(
        `Couldn't record the payment from ${row.fullName}: ${result.error}`,
      );
    }
  }

  /** Enter and the arrow keys move up and down a column, like a spreadsheet. */
  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || target.type === "checkbox") {
      return;
    }
    const rowIndex = Number(target.dataset.row);
    const column = target.dataset.col;
    if (Number.isNaN(rowIndex) || !column) return;

    if (column === "pay" && event.key === "Enter") {
      const row = visible[rowIndex];
      if (row && target.value.trim()) {
        event.preventDefault();
        void quickPay(row, target);
        return;
      }
    }

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
    <div className="space-y-6">
      <Summary
        rows={active}
        options={options}
        rooms={rooms}
        capacity={capacity}
        canSeeMoney={canSeeMoney}
        moneyOf={moneyOf}
      />

      <div
        role="search"
        className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-cream bg-white p-4"
      >
        <div className="w-full max-w-sm">
          <label htmlFor="find" className="block font-bold">
            Find someone
          </label>
          <Input
            id="find"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Name, email, reference or notes"
          />
        </div>
        {canSeeMoney ? (
          <>
            <Checkbox
              id="only-owing"
              label="Only people who owe money"
              checked={onlyOwing}
              onChange={(event) => setOnlyOwing(event.currentTarget.checked)}
            />
            <Checkbox
              id="only-overdue"
              label="Only overdue"
              checked={onlyOverdue}
              onChange={(event) => setOnlyOverdue(event.currentTarget.checked)}
            />
          </>
        ) : null}
        {cancelledCount ? (
          <Checkbox
            id="show-cancelled"
            label={`Show cancelled (${cancelledCount})`}
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.currentTarget.checked)}
          />
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="min-h-6 font-bold">
        {announcement}
      </p>
      {errorList.length ? (
        <Notice tone="error">
          <p className="font-bold">Some changes weren&apos;t saved:</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([key, message]) => {
              const row = rows.find((candidate) =>
                key.startsWith(candidate.bookingId),
              );
              return (
                <li key={key}>
                  {row?.fullName ?? "Someone"}: {message}
                </li>
              );
            })}
          </ul>
        </Notice>
      ) : null}

      <p>
        Showing {visible.length} of {active.length}{" "}
        {active.length === 1 ? "person" : "people"}.
        {canEdit
          ? " Type into a box to change it: it saves when you move on. Enter and the up and down arrows move between rows."
          : null}
        {canEdit && canSeeMoney
          ? " To record a bank transfer that arrived today, type the amount in Pay and press Enter. For cash or another date, use Add payment."
          : null}
      </p>

      {/* Focusable, so keyboard users can scroll it sideways too. */}
      <div
        role="region"
        aria-label="People booked"
        tabIndex={0}
        className="relative max-w-full overflow-x-auto rounded-2xl border border-cream bg-white"
      >
        <table
          ref={table}
          onKeyDown={onKeyDown}
          className="min-w-max border-collapse text-left text-base"
        >
          <caption className="sr-only">
            Everyone booked, the team first and then by name
          </caption>
          <thead className="bg-cream-light">
            <tr>
              <Th sticky>Name</Th>
              <Th>Ref</Th>
              <Th>Option</Th>
              <Th>Room</Th>
              {canSeeMoney ? (
                <>
                  <Th numeric>Total due</Th>
                  <Th numeric>Received</Th>
                  <Th numeric>Balance</Th>
                  {canEdit ? <Th>Pay today</Th> : null}
                </>
              ) : null}
              <Th>Dietary and health</Th>
              <Th>Mobile</Th>
              <Th>Email</Th>
              <Th>Emergency contact</Th>
              <Th>Notes</Th>
              {canSeeMoney ? (
                <>
                  <Th>Payment notes</Th>
                  <Th>Last email</Th>
                </>
              ) : null}
              <Th>Team</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => {
              const money = moneyOf(row);
              const editable = canEdit && !row.cancelled;
              const text = (
                field: Cell,
                label: string,
                value: string,
                width: string,
                extra: { type?: string; inputMode?: "email" | "tel" } = {},
              ) => {
                const key = `${row.bookingId}:${field}`;
                if (!editable) {
                  return (
                    <span className={cn("block px-2", width)}>{value}</span>
                  );
                }
                return (
                  <input
                    key={`${key}:${value}`}
                    data-row={rowIndex}
                    data-col={field}
                    aria-label={`${label} for ${row.fullName}`}
                    aria-invalid={errors[key] ? true : undefined}
                    title={value || undefined}
                    defaultValue={value}
                    spellCheck={field === "email" ? false : undefined}
                    {...extra}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== value) {
                        void save(row, field, label, event.currentTarget.value);
                      }
                    }}
                    className={cn(cellInput, width, statusClass(status[key]))}
                  />
                );
              };
              const select = (
                field: "optionId" | "roomId",
                label: string,
                value: string,
                choices: { id: string; name: string }[],
                empty: string,
                width = "w-56",
              ) => {
                const key = `${row.bookingId}:${field}`;
                const current = choices.find((choice) => choice.id === value);
                if (!editable) return current?.name ?? empty;
                return (
                  <select
                    key={`${key}:${value}`}
                    aria-label={`${label} for ${row.fullName}`}
                    aria-invalid={errors[key] ? true : undefined}
                    defaultValue={value}
                    onChange={(event) =>
                      void save(row, field, label, event.currentTarget.value)
                    }
                    className={cn(cellInput, width, statusClass(status[key]))}
                  >
                    <option value="">{empty}</option>
                    {choices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.name}
                      </option>
                    ))}
                  </select>
                );
              };

              return (
                <tr
                  key={row.bookingId}
                  className={cn(
                    "border-t border-cream align-middle",
                    row.cancelled && "text-stone",
                  )}
                >
                  <td className="sticky left-0 z-10 border-r border-cream bg-white px-1 py-1">
                    {text("fullName", "Name", row.fullName, "w-48")}
                  </td>
                  <Td>
                    <span className="block w-28 px-1 text-sm whitespace-nowrap">
                      <Link href={`/admin/bookings/${row.bookingId}`}>
                        {row.reference}
                        <span className="sr-only"> for {row.fullName}</span>
                      </Link>
                      {row.cancelled ? (
                        <span className="block font-bold">Cancelled</span>
                      ) : null}
                    </span>
                  </Td>
                  <Td>
                    {select(
                      "optionId",
                      "Option",
                      row.optionId,
                      options,
                      "No option",
                    )}
                  </Td>
                  <Td>
                    {select(
                      "roomId",
                      "Room",
                      row.roomId,
                      rooms,
                      "No room",
                      "w-40",
                    )}
                  </Td>
                  {canSeeMoney ? (
                    <>
                      <Td numeric>{formatPrice(row.pricePence)}</Td>
                      <Td numeric>
                        {formatPrice(row.paidPence)}
                        {editable ? (
                          <Button
                            type="button"
                            variant="link"
                            size="small"
                            className="ml-2 min-h-8 px-0 align-baseline"
                            onClick={() => setPaying(row)}
                          >
                            Add
                            <span className="sr-only">
                              {" "}
                              payment for {row.fullName}
                            </span>
                          </Button>
                        ) : null}
                      </Td>
                      <Td numeric>
                        <Balance money={money} />
                      </Td>
                      {canEdit ? (
                        <Td>
                          {editable ? (
                            <div className="relative w-28">
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-stone"
                              >
                                £
                              </span>
                              <input
                                data-row={rowIndex}
                                data-col="pay"
                                inputMode="decimal"
                                aria-label={`Payment received today from ${row.fullName}`}
                                aria-invalid={
                                  errors[`${row.bookingId}:pay`]
                                    ? true
                                    : undefined
                                }
                                placeholder={
                                  money.balancePence > 0
                                    ? penceToPoundsInput(
                                        money.depositOwedPence ||
                                          money.balancePence,
                                      )
                                    : ""
                                }
                                className={cn(
                                  cellInput,
                                  "w-28 border-cream bg-cream-light pl-6 placeholder:text-stone/70",
                                  statusClass(status[`${row.bookingId}:pay`]),
                                )}
                              />
                            </div>
                          ) : null}
                        </Td>
                      ) : null}
                    </>
                  ) : null}
                  <Td>
                    {text(
                      "dietaryHealth",
                      "Dietary and health",
                      row.dietaryHealth,
                      "w-56",
                    )}
                  </Td>
                  <Td>
                    {text("phone", "Mobile", row.phone, "w-40", {
                      type: "tel",
                      inputMode: "tel",
                    })}
                  </Td>
                  <Td>
                    {text("email", "Email", row.email, "w-64", {
                      type: "email",
                      inputMode: "email",
                    })}
                  </Td>
                  <Td>
                    {text(
                      "emergencyContact",
                      "Emergency contact",
                      row.emergencyContact,
                      "w-64",
                    )}
                  </Td>
                  <Td>{text("notes", "Notes", row.notes, "w-64")}</Td>
                  {canSeeMoney ? (
                    <>
                      <Td>
                        {text(
                          "paymentNotes",
                          "Payment notes",
                          row.paymentNotes,
                          "w-56",
                        )}
                      </Td>
                      <Td>
                        <span className="block w-32 px-1 whitespace-nowrap">
                          {row.lastEmail
                            ? `${TEMPLATE_SHORT[row.lastEmail.template] ?? row.lastEmail.template}${row.lastEmail.sentOn ? ` ${formatUkDate(row.lastEmail.sentOn)}` : ""}`
                            : "None yet"}
                        </span>
                      </Td>
                    </>
                  ) : null}
                  <Td>
                    {editable ? (
                      <input
                        type="checkbox"
                        aria-label={`${row.fullName} is on the team`}
                        checked={row.isTeam}
                        onChange={(event) =>
                          void save(
                            row,
                            "isTeam",
                            "Team",
                            String(event.currentTarget.checked),
                          )
                        }
                        className="mx-2 size-6 align-middle accent-coral-deep"
                      />
                    ) : row.isTeam ? (
                      "Yes"
                    ) : (
                      ""
                    )}
                  </Td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-6">
                  {rows.length === 0
                    ? "Nobody is booked yet. Add someone below, or import the spreadsheet."
                    : "Nobody matches. Try a different search, or untick the filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <AddPersonForm
          eventId={eventId}
          options={options}
          rooms={rooms}
          knownPeople={knownPeople}
          onAdded={(row) => {
            setRows((current) => [...current, row].sort(comparePeople));
            setAnnouncement(`Added ${row.fullName} (${row.reference}).`);
          }}
        />
      ) : null}

      {paying ? (
        <PaymentDialog
          row={paying}
          money={moneyOf(paying)}
          today={today}
          onClose={() => setPaying(null)}
          onRecorded={(row, emailNote) => {
            replaceRow(row);
            setPaying(null);
            setAnnouncement(
              `Payment recorded for ${row.fullName}. They've now paid ${formatPrice(row.paidPence)}.${emailNote ? ` ${emailNote}` : ""}`,
            );
          }}
        />
      ) : null}
    </div>
  );
}

const cellInput =
  "block min-h-10 rounded-md border-2 border-transparent bg-transparent px-2 text-base text-ink hover:border-cream focus-visible:border-coral-deep focus-visible:bg-white aria-invalid:border-danger";

function statusClass(status: Status | undefined): string | null {
  if (status === "saving") return "border-dashed border-stone";
  if (status === "saved") return "border-teal-deep/40";
  return null;
}

function Th({
  children,
  sticky,
  numeric,
}: {
  children: ReactNode;
  sticky?: boolean;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-2 py-3 font-bold whitespace-nowrap",
        sticky && "sticky left-0 z-20 border-r border-cream bg-cream-light",
        numeric && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-1 py-1",
        numeric && "px-2 text-right whitespace-nowrap",
      )}
    >
      {children}
    </td>
  );
}

function Balance({ money }: { money: BookingMoney }) {
  if (money.state === "cancelled") return <span>–</span>;
  if (money.balancePence < 0) {
    return <span>Overpaid {formatPrice(-money.balancePence)}</span>;
  }
  return (
    <span className={cn(money.overdue && "font-bold text-danger")}>
      {formatPrice(money.balancePence)}
      {money.overdue ? <span className="ml-1 text-sm">Overdue</span> : null}
    </span>
  );
}

function Summary({
  rows,
  options,
  rooms,
  capacity,
  canSeeMoney,
  moneyOf,
}: {
  rows: PersonRow[];
  options: GridOption[];
  rooms: GridRoom[];
  capacity: number;
  canSeeMoney: boolean;
  moneyOf: (row: PersonRow) => BookingMoney;
}) {
  const count = (predicate: (row: PersonRow) => boolean) =>
    rows.filter(predicate).length;
  const left = capacity - rows.length;
  const money = rows.map(moneyOf);
  const due = rows.reduce((sum, row) => sum + row.pricePence, 0);
  const received = rows.reduce((sum, row) => sum + row.paidPence, 0);
  const owed = money.reduce(
    (sum, item) => sum + Math.max(item.balancePence, 0),
    0,
  );
  const overdue = money.filter((item) => item.overdue);
  const noOption = count((row) => !row.optionId);
  const noRoom = count((row) => !row.roomId);

  return (
    <section
      aria-label="Summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Stat title="Places">
        <p className="text-2xl font-bold">
          {rows.length} of {capacity}
        </p>
        <p>
          {left > 0 ? `${left} left` : left === 0 ? "Full" : `${-left} over`}
        </p>
      </Stat>
      <Stat title="Options">
        <ul>
          {options.map((option) => (
            <li key={option.id}>
              {option.name}:{" "}
              <strong>{count((row) => row.optionId === option.id)}</strong>
            </li>
          ))}
          {noOption ? (
            <li>
              No option: <strong>{noOption}</strong>
            </li>
          ) : null}
        </ul>
      </Stat>
      <Stat title="Rooms">
        {rooms.length ? (
          <ul>
            {rooms.map((room) => {
              const inRoom = count((row) => row.roomId === room.id);
              return (
                <li key={room.id}>
                  {room.name}: <strong>{inRoom}</strong>
                  {room.capacity ? ` of ${room.capacity}` : null}
                  {room.capacity && inRoom > room.capacity ? (
                    <strong className="text-danger"> (over)</strong>
                  ) : null}
                </li>
              );
            })}
            {noRoom ? (
              <li>
                No room: <strong>{noRoom}</strong>
              </li>
            ) : null}
          </ul>
        ) : (
          <p>No rooms set up yet.</p>
        )}
      </Stat>
      {canSeeMoney ? (
        <Stat title="Money">
          <p>
            Total due: <strong>{formatPrice(due)}</strong>
          </p>
          <p>
            Received: <strong>{formatPrice(received)}</strong>
          </p>
          <p>
            Still owed: <strong>{formatPrice(owed)}</strong>
          </p>
          {overdue.length ? (
            <p className="font-bold text-danger">
              Overdue: {overdue.length}{" "}
              {overdue.length === 1 ? "person" : "people"},{" "}
              {formatPrice(
                overdue.reduce((sum, item) => sum + item.balancePence, 0),
              )}
            </p>
          ) : null}
        </Stat>
      ) : null}
    </section>
  );
}

function Stat({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream bg-white p-4">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-1">{children}</div>
    </div>
  );
}
