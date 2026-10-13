/**
 * Builds CSV files that open cleanly in Excel: every value is quoted when it
 * needs to be, and anything that looks like a formula is made harmless, so a
 * name like "=SUM(…)" can't run as a formula when the file is opened.
 */

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text =
    typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value !== "number") {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: readonly (readonly (string | number | boolean | null | undefined)[])[],
): string {
  // The byte order mark tells Excel the file is UTF-8 (for £ signs and accents).
  return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
