/**
 * Helps the team decide how much to refund after a cancellation: the terms'
 * own words about cancelling (from Settings, so they're always the current
 * ones) and how long before the event it was. The amount is always the
 * team's choice (CLAUDE.md section 15, question 9). Safe to use in the
 * browser and on the server.
 */

/**
 * The paragraphs of the terms' section about cancelling: from the "## "
 * heading that mentions cancelling to the next heading. Empty if there
 * isn't one.
 */
export function cancellationTerms(termsText: string): string[] {
  const blocks = termsText
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const start = blocks.findIndex((block) => /^##\s.*cancel/i.test(block));
  if (start === -1) return [];
  const rest = blocks.slice(start + 1);
  const end = rest.findIndex((block) => block.startsWith("## "));
  return end === -1 ? rest : rest.slice(0, end);
}
