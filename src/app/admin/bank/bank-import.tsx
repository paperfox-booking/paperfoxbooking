"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Label, Select } from "@/components/ui/form";
import { matchStatement, type MatchBooking } from "@/lib/bank/match";
import {
  StatementError,
  readStatement,
  type StatementLine,
} from "@/lib/bank/statement";
import { formatUkDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { recordStatementPaymentsAction, type StatementResult } from "./actions";

const BATCH = 5;

interface Choice {
  bookingId: string;
  record: boolean;
}

/**
 * Upload a bank statement (CSV), check which booking each payment in is
 * for, then record them all. Nothing is saved until "Record" is pressed.
 */
export function BankImport({ bookings }: { bookings: MatchBooking[] }) {
  const [fileError, setFileError] = useState("");
  const [lines, setLines] = useState<StatementLine[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<(StatementResult | null)[]>([]);
  const [summary, setSummary] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);

  // A file chosen before the page finished loading hasn't been read yet.
  useEffect(() => {
    const early = fileInput.current?.files?.[0];
    if (early) void readFile(early);
    // Only when the page first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(
    () => new Map(bookings.map((booking) => [booking.bookingId, booking])),
    [bookings],
  );
  const matches = useMemo(
    () => (lines ? matchStatement(lines, bookings) : []),
    [lines, bookings],
  );
  const sorted = useMemo(
    () =>
      [...bookings].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "en-GB"),
      ),
    [bookings],
  );

  async function readFile(file: File | undefined) {
    setFileError("");
    setLines(null);
    setResults([]);
    setSummary("");
    if (!file) return;
    try {
      const statement = readStatement(await file.text());
      const found = matchStatement(statement, bookings);
      setLines(statement);
      setChoices(
        found.map((match) => ({
          bookingId: match.suggested ?? "",
          // Not someone who's already paid in full: it may be for someone else.
          record:
            Boolean(match.suggested) &&
            !match.alreadyRecorded &&
            (bookings.find((booking) => booking.bookingId === match.suggested)
              ?.balancePence ?? 0) > 0,
        })),
      );
      if (statement.length === 0) {
        setFileError("There's no money paid in on this statement.");
      }
    } catch (error) {
      setFileError(
        error instanceof StatementError
          ? error.message
          : "That file couldn't be read. Check it's a CSV file from online banking.",
      );
    }
  }

  function choose(index: number, change: Partial<Choice>) {
    setChoices((current) =>
      current.map((choice, at) =>
        at === index ? { ...choice, ...change } : choice,
      ),
    );
  }

  const toRecord = matches
    .map((match, index) => ({ match, index, choice: choices[index]! }))
    .filter(
      ({ choice, index }) =>
        choice?.record && choice.bookingId && !results[index],
    );
  const totalPence = toRecord.reduce(
    (total, { match }) => total + match.line.amountPence,
    0,
  );

  async function record() {
    setBusy(true);
    const next = [...results];
    let recorded = 0;
    let problems = 0;
    for (let start = 0; start < toRecord.length; start += BATCH) {
      const batch = toRecord.slice(start, start + BATCH);
      const response = await recordStatementPaymentsAction(
        batch.map(({ match, choice }) => ({
          bookingId: choice.bookingId,
          amountPence: match.line.amountPence,
          date: match.line.date,
          description: match.line.description,
        })),
      );
      if (!response.ok) {
        for (const { index } of batch) {
          next[index] = { recorded: false, error: response.error };
        }
        problems += batch.length;
        setResults([...next]);
        break;
      }
      response.results.forEach((result, at) => {
        next[batch[at]!.index] = result;
        if (result.recorded) recorded += 1;
        else problems += 1;
      });
      setResults([...next]);
      setSummary(`Recorded ${recorded} so far…`);
    }
    setSummary(
      `Recorded ${recorded} ${recorded === 1 ? "payment" : "payments"}.${problems ? ` ${problems} couldn't be recorded: see below.` : ""}`,
    );
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cream bg-white p-4">
        <Label htmlFor="statement-file">Bank statement (CSV file)</Label>
        <p id="statement-file-hint" className="text-stone">
          In online banking, download the statement for the dates you need as a
          CSV file. Nothing is saved until you check the matches and choose
          Record.
        </p>
        <input
          ref={fileInput}
          id="statement-file"
          type="file"
          accept=".csv,text/csv"
          aria-describedby="statement-file-hint"
          className="mt-2 block w-full max-w-md text-base file:mr-3 file:min-h-12 file:rounded-lg file:border-2 file:border-ink file:bg-white file:px-4 file:font-bold"
          onChange={(event) => void readFile(event.currentTarget.files?.[0])}
        />
        {fileError ? (
          <Notice tone="error" className="mt-3">
            {fileError}
          </Notice>
        ) : null}
      </div>

      {lines && lines.length ? (
        <>
          <p className="text-lg">
            <strong>{lines.length}</strong>{" "}
            {lines.length === 1 ? "payment in" : "payments in"} on the
            statement. {matches.filter((match) => match.suggested).length}{" "}
            matched to a booking. Check each one: change the booking if
            it&apos;s wrong, and untick anything that isn&apos;t a booking
            payment.
          </p>
          <ol className="space-y-3">
            {matches.map((match, index) => {
              const choice = choices[index]!;
              const result = results[index];
              const chosen = byId.get(choice.bookingId);
              const candidateIds = new Set(
                match.candidates.map((candidate) => candidate.bookingId),
              );
              return (
                <li
                  key={index}
                  className={cn(
                    "rounded-2xl border-2 bg-white p-4",
                    result?.recorded
                      ? "border-teal-deep"
                      : result
                        ? "border-danger"
                        : "border-cream",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">
                      {formatPrice(match.line.amountPence)} on{" "}
                      {formatUkDate(`${match.line.date}T12:00:00Z`)}
                    </p>
                    <p className="text-sm text-stone">Row {match.line.row}</p>
                  </div>
                  <p className="break-words">{match.line.description}</p>
                  {match.alreadyRecorded ? (
                    <p className="font-bold text-danger">
                      This looks already recorded: that booking has a payment of
                      the same amount on the same day.
                    </p>
                  ) : null}
                  {result ? (
                    <p
                      className={cn(
                        "mt-2 font-bold",
                        result.recorded ? "text-teal-deep" : "text-danger",
                      )}
                    >
                      {result.recorded
                        ? `Recorded for ${chosen?.fullName}.${result.emailNote ? ` ${result.emailNote}` : ""}`
                        : `Not recorded: ${result.error}`}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`booking-${index}`}>Booking</Label>
                        <Select
                          id={`booking-${index}`}
                          value={choice.bookingId}
                          onChange={(event) =>
                            choose(index, {
                              bookingId: event.currentTarget.value,
                              record: event.currentTarget.value !== "",
                            })
                          }
                          className="w-full max-w-xl"
                        >
                          <option value="">Not a booking payment</option>
                          {match.candidates.length ? (
                            <optgroup label="Likely">
                              {match.candidates.map((candidate) => {
                                const booking = byId.get(candidate.bookingId)!;
                                return (
                                  <option
                                    key={candidate.bookingId}
                                    value={candidate.bookingId}
                                  >
                                    {booking.fullName}, {booking.reference} (
                                    {candidate.why.charAt(0).toLowerCase() +
                                      candidate.why.slice(1)}
                                    )
                                  </option>
                                );
                              })}
                            </optgroup>
                          ) : null}
                          <optgroup label="Everyone">
                            {sorted
                              .filter(
                                (booking) =>
                                  !candidateIds.has(booking.bookingId),
                              )
                              .map((booking) => (
                                <option
                                  key={booking.bookingId}
                                  value={booking.bookingId}
                                >
                                  {booking.fullName}, {booking.reference},{" "}
                                  {booking.eventTitle}
                                </option>
                              ))}
                          </optgroup>
                        </Select>
                      </div>
                      <Checkbox
                        id={`record-${index}`}
                        label="Record"
                        checked={choice.record}
                        disabled={!choice.bookingId}
                        onChange={(event) =>
                          choose(index, { record: event.currentTarget.checked })
                        }
                      />
                    </div>
                  )}
                  {chosen && !result && chosen.balancePence <= 0 ? (
                    <p className="mt-2 font-bold text-danger">
                      {chosen.fullName} has already paid in full, so this may be
                      for someone else. Check before recording it.
                    </p>
                  ) : null}
                  {chosen && !result ? (
                    <p className="mt-2 text-sm text-stone">
                      {chosen.eventTitle}. Owes{" "}
                      {formatPrice(Math.max(chosen.balancePence, 0))}
                      {chosen.depositOwedPence
                        ? `, of which ${formatPrice(chosen.depositOwedPence)} is the deposit`
                        : ""}
                      .
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="sticky bottom-0 space-y-2 rounded-2xl border-2 border-coral bg-white p-4">
            <p aria-live="polite" className="font-bold">
              {summary ||
                `${toRecord.length} ${toRecord.length === 1 ? "payment" : "payments"} ticked, ${formatPrice(totalPence)} in total.`}
            </p>
            <Button
              type="button"
              size="large"
              disabled={busy || toRecord.length === 0}
              onClick={() => void record()}
            >
              {busy
                ? "Recording…"
                : `Record ${toRecord.length} ${toRecord.length === 1 ? "payment" : "payments"}`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
