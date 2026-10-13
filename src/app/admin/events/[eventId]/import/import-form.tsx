"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Label } from "@/components/ui/form";
import { formatPrice } from "@/lib/money";
import { importAction, previewImportAction, type ImportState } from "./actions";

/**
 * Step 1: choose the file and check it. Step 2: read the preview, then import.
 * The file stays chosen between the two, and is read again when importing.
 */
export function ImportForm({ eventId }: { eventId: string }) {
  const file = useRef<File | null>(null);
  const [preview, previewFormAction, checking] = useActionState(
    (previous: ImportState, formData: FormData) =>
      previewImportAction(eventId, previous, formData),
    {},
  );
  const [result, importFormAction, importing] = useActionState(
    (previous: ImportState) => {
      const formData = new FormData();
      if (file.current) formData.set("file", file.current);
      return importAction(eventId, previous, formData);
    },
    {},
  );
  const report = preview.report;
  const toCheck =
    report?.people.filter((person) => person.warnings.length) ?? [];

  return (
    <div className="space-y-8">
      <Card>
        <form action={previewFormAction} className="space-y-4">
          <h2 className="text-3xl">1. Choose the spreadsheet</h2>
          <p>
            An Excel file (.xlsx) with one row per person and headings such as
            Name, Email, Friday Cropping, Room, Dietary/Health, Total Due, Money
            Received, Mobile, Emergency Contact, Notes and Booking Sent, like
            the March 2027 sheet. Nothing is saved until you choose Import.
          </p>
          {preview.error ? <Notice tone="error">{preview.error}</Notice> : null}
          <div className="space-y-2">
            <Label htmlFor="file">Spreadsheet file</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onChange={(event) => {
                file.current = event.currentTarget.files?.[0] ?? null;
              }}
              className="block w-full rounded-lg border-2 border-stone bg-white p-2 text-base"
            />
          </div>
          <Button type="submit" disabled={checking}>
            {checking ? "Checking…" : "Check the spreadsheet"}
          </Button>
        </form>
      </Card>

      {report ? (
        <section aria-labelledby="preview-heading" className="space-y-6">
          <h2 id="preview-heading" className="text-3xl">
            2. Check what will be imported
          </h2>

          <Card>
            <ul className="space-y-1 text-lg">
              <li>
                <strong>{report.people.length}</strong> people, including{" "}
                {report.people.filter((person) => person.isTeam).length} on the
                team (rows marked AA).
              </li>
              <li>
                Total due <strong>{formatPrice(report.totals.duePence)}</strong>
                , received{" "}
                <strong>{formatPrice(report.totals.receivedPence)}</strong>,
                still owed{" "}
                <strong>{formatPrice(report.totals.owedPence)}</strong>.
              </li>
              <li>
                Rooms:{" "}
                {report.rooms
                  .map((room) => {
                    const count = report.people.filter(
                      (person) => person.room === room.name,
                    ).length;
                    return `${room.name} ${count}${room.capacity ? ` of ${room.capacity}` : ""}`;
                  })
                  .join(", ")}
                .
              </li>
              <li>
                Emails already sent are brought across too, with the date the
                sheet gives.
              </li>
            </ul>
          </Card>

          {report.notes.length ? (
            <Notice>
              <p className="font-bold">About the whole sheet</p>
              <ul className="mt-1 list-disc pl-5">
                {report.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {toCheck.length ? (
            <div>
              <h3 className="text-2xl">
                {toCheck.length} {toCheck.length === 1 ? "row" : "rows"} to
                check
              </h3>
              <p>
                These will still be imported as described. You can correct them
                on the people booked list afterwards.
              </p>
              <ul className="mt-3 space-y-3">
                {toCheck.map((person) => (
                  <li
                    key={person.rowNumber}
                    className="rounded-lg border-l-4 border-coral bg-white p-3"
                  >
                    <p className="font-bold">
                      Row {person.rowNumber}: {person.fullName}
                    </p>
                    <ul className="list-disc pl-5">
                      {person.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.skipped.length ? (
            <div>
              <h3 className="text-2xl">Rows not imported</h3>
              <ul className="mt-2 list-disc pl-5">
                {report.skipped.map((skip) => (
                  <li key={skip.rowNumber}>
                    Row {skip.rowNumber}: {skip.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="rounded-2xl border border-cream bg-white p-4">
            <summary className="cursor-pointer font-bold">
              See everyone who will be imported
            </summary>
            <div
              role="region"
              aria-label="Everyone who will be imported"
              tabIndex={0}
              className="relative mt-3 max-w-full overflow-x-auto"
            >
              <table className="min-w-max text-left">
                <thead>
                  <tr className="border-b border-cream">
                    <th scope="col" className="px-2 py-1">
                      Row
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Name
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Option
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Room
                    </th>
                    <th scope="col" className="px-2 py-1 text-right">
                      Total
                    </th>
                    <th scope="col" className="px-2 py-1 text-right">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.people.map((person) => (
                    <tr
                      key={person.rowNumber}
                      className="border-b border-cream"
                    >
                      <td className="px-2 py-1">{person.rowNumber}</td>
                      <td className="px-2 py-1">
                        {person.fullName}
                        {person.isTeam ? " (team)" : null}
                      </td>
                      <td className="px-2 py-1">
                        {person.optionName ?? "None"}
                      </td>
                      <td className="px-2 py-1">{person.room}</td>
                      <td className="px-2 py-1 text-right">
                        {formatPrice(person.pricePence)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatPrice(person.receivedPence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <form action={importFormAction} className="space-y-3">
            {result.error ? <Notice tone="error">{result.error}</Notice> : null}
            <Button type="submit" size="large" disabled={importing}>
              {importing
                ? "Importing…"
                : `Import ${report.people.length} people`}
            </Button>
            <p className="text-stone">
              Everyone is saved together, or nobody is, so it&apos;s safe to try
              again if something goes wrong.
            </p>
          </form>
        </section>
      ) : null}
    </div>
  );
}
