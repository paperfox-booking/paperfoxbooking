import { daysBetween, isIsoDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

/**
 * Reads an event's booking spreadsheet (one row per person, like Paper Fox's
 * March 2027 sheet) into people to import, and lists anything that needs a
 * second look. It never changes anyone's money silently: where the sheet
 * disagrees with itself, it keeps what the row says and explains.
 *
 * Columns are found by their headings, so their order doesn't matter:
 * Name, Email, Friday Cropping (start time), Room, Dietary/Health, Total Due,
 * Money Received, Balance Due, Mobile, Emergency Contact, Notes and Booking
 * Sent. Name and Total Due are needed; the rest are optional.
 */

export type Cell = string | number | boolean | Date | null;

export type EmailTemplate =
  "B1" | "B2" | "B3" | "thanks" | "balance_reminder" | "other";

export interface SheetOption {
  id: string;
  name: string;
  pricePence: number;
  /** UK clock time the option starts, "09:00", if it has its own. */
  startTime: string | null;
}

export interface ImportPerson {
  /** The row number in the spreadsheet, as people see it. */
  rowNumber: number;
  fullName: string;
  isTeam: boolean;
  email: string | null;
  optionId: string | null;
  optionName: string | null;
  room: string;
  dietaryHealth: string;
  pricePence: number;
  priceNote: string;
  receivedPence: number;
  phone: string;
  emergencyContact: string;
  notes: string;
  lastEmail: {
    template: EmailTemplate;
    sentOn: string | null;
    note: string;
  } | null;
  warnings: string[];
}

export interface SheetReport {
  people: ImportPerson[];
  rooms: { name: string; capacity: number | null }[];
  skipped: { rowNumber: number; reason: string }[];
  /** Findings about the whole sheet, such as totals that don't add up. */
  notes: string[];
  totals: { duePence: number; receivedPence: number; owedPence: number };
}

/** The sheet's layout couldn't be understood, so nothing can be imported. */
export class SheetLayoutError extends Error {}

export const MAIN_ROOM = "Main room";

const COLUMNS = {
  name: /\bname\b/i,
  email: /^\s*e-?mail/i,
  start: /friday|start|arriv|cropping/i,
  room: /room/i,
  dietary: /diet|health|allerg/i,
  total: /total|price/i,
  balance: /balance|owed|outstanding/i,
  received: /received|paid/i,
  mobile: /mobile|phone|tel/i,
  emergency: /emergency/i,
  notes: /^\s*notes?\b/i,
  sent: /sent|comms/i,
} as const;
type Column = keyof typeof COLUMNS;

function text(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).replace(/\s+/g, " ").trim();
}

/** A money cell in pounds as pence, or null if it's empty or not a number. */
function pence(cell: Cell | undefined): number | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return Math.round(cell * 100);
  }
  const value = text(cell).replace(/^£/, "").replace(/,/g, "");
  if (value === "" || !/^-?\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function findHeader(rows: Cell[][]): {
  index: number;
  columns: Partial<Record<Column, number>>;
} {
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const headings = (rows[index] ?? []).map((cell) => text(cell));
    const columns: Partial<Record<Column, number>> = {};
    const used = new Set<number>();
    for (const column of Object.keys(COLUMNS) as Column[]) {
      const found = headings.findIndex(
        (heading, position) =>
          !used.has(position) &&
          heading !== "" &&
          COLUMNS[column].test(heading),
      );
      if (found !== -1) {
        columns[column] = found;
        used.add(found);
      }
    }
    // "Balance Due" mustn't be mistaken for the total if there's no "Total".
    if (columns.total === undefined) {
      const due = headings.findIndex(
        (heading, position) => !used.has(position) && /\bdue\b/i.test(heading),
      );
      if (due !== -1) columns.total = due;
    }
    if (columns.name !== undefined && columns.total !== undefined) {
      return { index, columns };
    }
  }
  throw new SheetLayoutError(
    "We couldn't find the headings. The first rows need a Name column and a Total Due column, like the March 2027 spreadsheet.",
  );
}

function tidyRoom(raw: string): string {
  if (raw === "") return MAIN_ROOM;
  return raw
    .toLowerCase()
    .split(" ")
    .map((word) =>
      /^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function normaliseStart(raw: string): "9am" | "4pm" | "none" | "unknown" {
  const value = raw.toLowerCase().replace(/\s+/g, "");
  if (value === "" || value === "n/a" || value === "na") return "none";
  if (/^0?9(:00)?am$|^0?9:00$/.test(value)) return "9am";
  if (/^4(:00)?pm$|^16:00$/.test(value)) return "4pm";
  return "unknown";
}

function optionForStart(
  options: SheetOption[],
  start: "9am" | "4pm",
): SheetOption | undefined {
  const time = start === "9am" ? "09:00" : "16:00";
  const words = start === "9am" ? /9\s*am/i : /4\s*pm/i;
  return (
    options.find((option) => option.startTime === time) ??
    options.find((option) => words.test(option.name))
  );
}

const TEMPLATES: [RegExp, EmailTemplate][] = [
  [/^b\s*1$/i, "B1"],
  [/^b\s*2$/i, "B2"],
  [/^b\s*3$/i, "B3"],
  [/thk|thank/i, "thanks"],
  [/remind/i, "balance_reminder"],
];

/**
 * "22/03 - B2" → B2 sent on 22 March. The sheet leaves out the year, so it's
 * the most recent 22 March on or before today.
 */
function readLastEmail(raw: string, today: string): ImportPerson["lastEmail"] {
  if (raw === "") return null;
  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*[-–]\s*(.+)$/.exec(
    raw,
  );
  if (!match) return { template: "other", sentOn: null, note: raw };
  const [, day, month, year, label] = match as unknown as [
    string,
    string,
    string,
    string | undefined,
    string,
  ];
  const template =
    TEMPLATES.find(([pattern]) => pattern.test(label.trim()))?.[1] ?? "other";
  const pad = (value: string) => value.padStart(2, "0");
  let sentOn: string | null = null;
  if (year) {
    const fullYear = year.length === 2 ? `20${year}` : year;
    const candidate = `${fullYear}-${pad(month)}-${pad(day)}`;
    sentOn = isIsoDate(candidate) ? candidate : null;
  } else {
    const thisYear = Number(today.slice(0, 4));
    for (const tryYear of [thisYear, thisYear - 1]) {
      const candidate = `${tryYear}-${pad(month)}-${pad(day)}`;
      if (isIsoDate(candidate) && daysBetween(candidate, today) >= 0) {
        sentOn = candidate;
        break;
      }
    }
  }
  return {
    template,
    sentOn,
    note: template === "other" ? label.trim() : "",
  };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function readBookingSheet(
  rows: Cell[][],
  options: SheetOption[],
  today: string,
): SheetReport {
  const { index: headerIndex, columns } = findHeader(rows);
  const cell = (row: Cell[], column: Column): Cell | undefined =>
    columns[column] === undefined ? undefined : row[columns[column]!];

  const header = rows[headerIndex] ?? [];
  const mainCapacity = /max\s*(\d+)/i.exec(text(header[columns.name!] ?? null));
  const rooms = new Map<string, number | null>([
    [MAIN_ROOM, mainCapacity ? Number(mainCapacity[1]) : null],
  ]);

  const people: ImportPerson[] = [];
  const skipped: SheetReport["skipped"] = [];
  const notes: string[] = [];
  let sheetTotals: {
    due: number | null;
    received: number | null;
    owed: number | null;
  } | null = null;

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowNumber = index + 1;
    const rawName = text(cell(row, "name"));
    const hasAnything = row.some((value) => text(value) !== "");

    if (sheetTotals) {
      if (hasAnything) {
        skipped.push({
          rowNumber,
          reason:
            "Below the totals, so not imported. If it's the waiting list, add these people again once the waiting list is built.",
        });
      }
      continue;
    }
    if (rawName === "") {
      if (pence(cell(row, "total")) !== null) {
        sheetTotals = {
          due: pence(cell(row, "total")),
          received: pence(cell(row, "received")),
          owed: pence(cell(row, "balance")),
        };
      } else if (hasAnything) {
        skipped.push({ rowNumber, reason: "No name, so not imported." });
      }
      continue;
    }

    const warnings: string[] = [];
    const isTeam = /^aa\s+/i.test(rawName);
    const fullName = rawName.replace(/^aa\s+/i, "").slice(0, 200);
    if (/\s(&|and)\s/i.test(fullName)) {
      warnings.push(
        "This row has two names. It's imported as one place: if it's two places, add the second person afterwards.",
      );
    }

    const rawEmail = text(cell(row, "email")).toLowerCase();
    let email: string | null = null;
    if (rawEmail !== "") {
      if (EMAIL.test(rawEmail) && rawEmail.length <= 254) email = rawEmail;
      else {
        warnings.push(
          `"${rawEmail}" doesn't look like an email address, so it was left out.`,
        );
      }
    }

    const rawStart = text(cell(row, "start"));
    const start = normaliseStart(rawStart);
    const rawPrice = pence(cell(row, "total"));
    let option: SheetOption | undefined;
    if (start === "9am" || start === "4pm") {
      option = optionForStart(options, start);
      if (!option) {
        warnings.push(
          `The event has no ${start} option, so no option was chosen.`,
        );
      }
    } else if (rawPrice !== null && rawPrice > 0) {
      const byPrice = options.filter(
        (choice) => choice.pricePence === rawPrice,
      );
      if (byPrice.length === 1) {
        option = byPrice[0];
        warnings.push(
          rawStart === ""
            ? `No start time was given, so ${option!.name} was chosen from the price.`
            : `The start time was "${rawStart}", so ${option!.name} was chosen from the price.`,
        );
      } else {
        warnings.push(
          "We couldn't tell which option this is. Choose one after importing.",
        );
      }
    }

    let pricePence = rawPrice;
    let priceNote = "";
    if (pricePence === null) {
      pricePence = option?.pricePence ?? 0;
      warnings.push(
        option
          ? `No total due, so the option's price (${formatPrice(pricePence)}) was used.`
          : "No total due, so it was imported as £0.",
      );
    } else if (pricePence < 0) {
      warnings.push("The total due was below £0, so it was imported as £0.");
      pricePence = 0;
    } else if (option && pricePence !== option.pricePence) {
      warnings.push(
        `Charged ${formatPrice(pricePence)}, but ${option.name} is ${formatPrice(option.pricePence)}. The spreadsheet's ${formatPrice(pricePence)} is kept.`,
      );
      priceNote = "Price brought over from the spreadsheet.";
    }

    let receivedPence = pence(cell(row, "received")) ?? 0;
    if (receivedPence < 0) {
      warnings.push("Money received was below £0, so it was left out.");
      receivedPence = 0;
    }
    const owed = pricePence - receivedPence;
    if (receivedPence > pricePence) {
      warnings.push(
        `Paid ${formatPrice(receivedPence - pricePence)} more than the total due.`,
      );
    }
    if (columns.balance !== undefined) {
      const sheetBalance = pence(cell(row, "balance"));
      if (sheetBalance === null && owed !== 0) {
        warnings.push(
          `The spreadsheet had no balance for this row. The system works it out as ${formatPrice(owed)}.`,
        );
      } else if (sheetBalance !== null && sheetBalance !== owed) {
        warnings.push(
          `The spreadsheet's balance was ${formatPrice(sheetBalance)}, but ${formatPrice(pricePence)} less ${formatPrice(receivedPence)} paid leaves ${formatPrice(owed)}. The system uses ${formatPrice(owed)}.`,
        );
      }
    }

    const room = tidyRoom(text(cell(row, "room")));
    if (!rooms.has(room)) rooms.set(room, null);

    people.push({
      rowNumber,
      fullName,
      isTeam,
      email,
      optionId: option?.id ?? null,
      optionName: option?.name ?? null,
      room,
      dietaryHealth: text(cell(row, "dietary")).slice(0, 1000),
      pricePence,
      priceNote,
      receivedPence,
      phone: text(cell(row, "mobile")).slice(0, 40),
      emergencyContact: text(cell(row, "emergency")).slice(0, 300),
      notes: text(cell(row, "notes")).slice(0, 2000),
      lastEmail: readLastEmail(text(cell(row, "sent")), today),
      warnings,
    });
  }

  const totals = {
    duePence: people.reduce((sum, person) => sum + person.pricePence, 0),
    receivedPence: people.reduce(
      (sum, person) => sum + person.receivedPence,
      0,
    ),
    owedPence: 0,
  };
  totals.owedPence = totals.duePence - totals.receivedPence;

  if (sheetTotals) {
    const compare = (
      label: string,
      sheet: number | null,
      rowsAddUpTo: number,
    ) => {
      if (sheet !== null && sheet !== rowsAddUpTo) {
        notes.push(
          `The spreadsheet's ${label} total is ${formatPrice(sheet)}, but the rows add up to ${formatPrice(rowsAddUpTo)}. The system uses each row's own figures.`,
        );
      }
    };
    compare("Total Due", sheetTotals.due, totals.duePence);
    compare("Money Received", sheetTotals.received, totals.receivedPence);
    compare("Balance Due", sheetTotals.owed, totals.owedPence);
  }

  const seen = new Map<string, number>();
  for (const person of people) {
    if (!person.email) continue;
    const earlier = seen.get(person.email);
    if (earlier !== undefined) {
      person.warnings.push(
        `Same email as row ${earlier}. Each person needs their own email address, so this one was left out.`,
      );
      person.email = null;
    } else {
      seen.set(person.email, person.rowNumber);
    }
  }

  return {
    people,
    rooms: [...rooms].map(([name, capacity]) => ({ name, capacity })),
    skipped,
    notes,
    totals,
  };
}
