/**
 * Reading a bank statement exported as a CSV file. Banks lay these out
 * differently, so this looks for the header row and works out which columns
 * hold the date, the description and the money paid in. Only money paid in
 * is kept. Safe to use in the browser and on the server.
 */

export interface StatementLine {
  /** Its row in the file, counting from 1, for "row 12" in messages. */
  row: number;
  /** "YYYY-MM-DD". */
  date: string;
  description: string;
  amountPence: number;
}

export class StatementError extends Error {}

/**
 * Splits CSV text into rows of cells, handling quotes and new lines in
 * quotes. Row numbers match what a spreadsheet would show.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Blank rows are kept (as row numbers matter), except at the end.
  while (rows.length && rows.at(-1)!.every((value) => value.trim() === "")) {
    rows.pop();
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** UK bank dates: 31/12/2026, 31-12-26, 2026-12-31 or 31 Dec 2026. */
export function parseStatementDate(value: string): string | null {
  const text = value.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return isoDate(+match[1]!, +match[2]!, +match[3]!);
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (match) {
    const year = match[3]!.length === 2 ? 2000 + +match[3]! : +match[3]!;
    return isoDate(year, +match[2]!, +match[1]!);
  }
  match = /^(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-](\d{2}|\d{4})$/i.exec(text);
  if (match) {
    const month = MONTHS[match[2]!.toLowerCase()];
    const year = match[3]!.length === 2 ? 2000 + +match[3]! : +match[3]!;
    return month ? isoDate(year, month, +match[1]!) : null;
  }
  return null;
}

/** "£1,234.50", "1234.5", "-60.00", "(60.00)" or "60.00 CR" in pence. */
export function parseStatementAmount(value: string): number | null {
  let text = value.trim().replace(/[£,\s]/g, "");
  if (text === "") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (/CR$/i.test(text)) text = text.slice(0, -2);
  else if (/DR$/i.test(text)) {
    sign = -1;
    text = text.slice(0, -2);
  }
  if (text.startsWith("-")) {
    sign = -sign;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [pounds, pence = ""] = text.split(".");
  return sign * (Number(pounds) * 100 + Number(pence.padEnd(2, "0")));
}

interface Columns {
  date: number;
  description: number[];
  /** A single signed amount column, or separate paid in and paid out ones. */
  amount: number | null;
  paidIn: number | null;
}

function findColumns(header: string[]): Columns | null {
  const names = header.map((cell) => cell.trim().toLowerCase());
  const find = (test: (name: string) => boolean) => names.findIndex(test);
  const date = find((name) => name.includes("date"));
  const paidIn = find((name) =>
    /paid in|money in|credit|^in$|receipts|deposits/.test(name),
  );
  const amount = find((name) => /amount|value/.test(name));
  const description = names
    .map((name, index) => ({ name, index }))
    .filter(({ name }) =>
      /description|reference|details|narrative|memo|payee|name|transaction|particulars|type|counter ?party/.test(
        name,
      ),
    )
    // Not the date or money, nor Paper Fox's own account (NatWest puts the
    // account name on every line).
    .filter(
      ({ name }) =>
        !/date|balance|amount|account name|account number|sort code/.test(name),
    )
    .map(({ index }) => index);
  if (date < 0 || (paidIn < 0 && amount < 0) || description.length === 0) {
    return null;
  }
  return {
    date,
    description,
    amount: amount >= 0 ? amount : null,
    paidIn: paidIn >= 0 ? paidIn : null,
  };
}

/** The money paid in, from a bank statement CSV. */
export function readStatement(text: string): StatementLine[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((cells) => findColumns(cells) !== null);
  if (headerIndex < 0) {
    const headerless = readHeaderless(rows);
    if (headerless.length) return headerless;
    throw new StatementError(
      "This file doesn't look like a bank statement. It needs columns for the date, the description and the amount (or money paid in). Download the statement from online banking as a CSV file and try again.",
    );
  }
  const columns = findColumns(rows[headerIndex]!)!;
  const lines: StatementLine[] = [];
  for (const [offset, cells] of rows.slice(headerIndex + 1).entries()) {
    const date = parseStatementDate(cells[columns.date] ?? "");
    if (!date) continue;
    const amount =
      columns.paidIn !== null
        ? parseStatementAmount(cells[columns.paidIn] ?? "")
        : parseStatementAmount(cells[columns.amount!] ?? "");
    if (amount === null || amount <= 0) continue;
    const description = columns.description
      .map((index) => (cells[index] ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    lines.push({
      row: headerIndex + offset + 2,
      date,
      description,
      amountPence: amount,
    });
  }
  return lines;
}

/**
 * Some banks (HSBC, for example) export just date, description and amount,
 * with no header row. Read files of that shape too.
 */
function readHeaderless(rows: string[][]): StatementLine[] {
  const looksRight = rows.some(
    (cells) =>
      cells.length >= 3 &&
      parseStatementDate(cells[0] ?? "") !== null &&
      parseStatementAmount(cells[2] ?? "") !== null,
  );
  if (!looksRight) return [];
  const lines: StatementLine[] = [];
  for (const [index, cells] of rows.entries()) {
    const date = parseStatementDate(cells[0] ?? "");
    const amount = parseStatementAmount(cells[2] ?? "");
    if (!date || amount === null || amount <= 0) continue;
    lines.push({
      row: index + 1,
      date,
      description: (cells[1] ?? "").trim().replace(/\s+/g, " "),
      amountPence: amount,
    });
  }
  return lines;
}

/**
 * Turns the file's bytes into text. Most banks use UTF-8; some (Nationwide,
 * for example) use the older Windows encoding, where "£" would otherwise be
 * misread and every amount lost.
 */
export function decodeStatement(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
