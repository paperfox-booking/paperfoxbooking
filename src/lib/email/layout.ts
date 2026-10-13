/**
 * Turns an email's plain wording into a branded email that works on a phone,
 * plus a plain text copy for email apps that don't show HTML.
 *
 * The wording is kept simple so anyone can edit it:
 *   - a blank line starts a new paragraph;
 *   - lines starting "- " make a bulleted list;
 *   - web and email addresses become links.
 *
 * Colours follow the site's theme (src/app/globals.css): ink text on white,
 * a teal band at the top, and coral-deep links (6.16:1 on white).
 */

export interface EmailBusiness {
  businessName: string;
  legalName: string;
  companyNumber: string;
  address: string;
  website: string;
  facebookUrl: string;
  facebookGroupUrl: string;
  instagramUrl: string;
  signOff: string;
}

const INK = "#221e1f";
const TEAL = "#93ded0";
const CREAM_LIGHT = "#f7f4f0";
const CORAL_DEEP = "#b82c14";
const STONE = "#6f6466";
const FONT = "'Nunito Sans', Helvetica, Arial, sans-serif";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LINK_PATTERN =
  /\b(https?:\/\/[^\s<]+[^\s<.,;:!?)'"]|www\.[^\s<]+[^\s<.,;:!?)'"]|[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,})/gi;

/** Escapes a line and turns web and email addresses in it into links. */
function lineToHtml(line: string): string {
  let html = "";
  let last = 0;
  for (const match of line.matchAll(LINK_PATTERN)) {
    const text = match[0];
    const start = match.index;
    html += escapeHtml(line.slice(last, start));
    const href =
      text.includes("@") && !text.startsWith("http")
        ? `mailto:${text}`
        : text.startsWith("www.")
          ? `https://${text}`
          : text;
    html += `<a href="${escapeHtml(href)}" style="color:${CORAL_DEEP};text-decoration:underline;">${escapeHtml(text)}</a>`;
    last = start + text.length;
  }
  return html + escapeHtml(line.slice(last));
}

/** The wording, as HTML paragraphs and lists. */
export function textToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trimEnd()))
    .map((lines) => lines.filter((line) => line.trim() !== ""))
    .filter((lines) => lines.length > 0);

  return blocks
    .map((lines) => {
      if (lines.every((line) => /^\s*- /.test(line))) {
        const items = lines
          .map(
            (line) =>
              `<li style="margin:0 0 8px;">${lineToHtml(line.replace(/^\s*- /, ""))}</li>`,
          )
          .join("");
        return `<ul style="margin:0 0 16px;padding-left:24px;">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px;">${lines.map(lineToHtml).join("<br>")}</p>`;
    })
    .join("\n");
}

function withoutScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** "Regards, Nichola & Morag", the website and the social links. */
export function signOffText(business: EmailBusiness): string {
  const follow = [
    business.facebookUrl && `Facebook: ${business.facebookUrl}`,
    business.facebookGroupUrl && `Facebook group: ${business.facebookGroupUrl}`,
    business.instagramUrl && `Instagram: ${business.instagramUrl}`,
  ].filter(Boolean);
  return [
    "Regards",
    "",
    [business.signOff, business.businessName, withoutScheme(business.website)]
      .filter(Boolean)
      .join("\n"),
    ...(follow.length
      ? [
          "",
          "To keep up to date with the latest, follow us:",
          follow.join("\n"),
        ]
      : []),
  ].join("\n");
}

function footerText(business: EmailBusiness): string {
  const company = [
    business.legalName,
    business.companyNumber && `company number ${business.companyNumber}`,
  ]
    .filter(Boolean)
    .join(", ");
  return [company, business.address.split("\n").join(", ")]
    .filter(Boolean)
    .join(". ");
}

/** The plain text copy of the whole email. */
export function emailText(body: string, business: EmailBusiness): string {
  return `${body.trim()}\n\n${signOffText(business)}\n\n--\n${footerText(business)}\n`;
}

/** The whole email as HTML, with the brand header and the footer. */
export function emailHtml({
  subject,
  body,
  business,
  logoUrl,
}: {
  subject: string;
  body: string;
  business: EmailBusiness;
  /** An absolute address for the fox logo, or empty to leave it out. */
  logoUrl: string;
}): string {
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:10px;margin-right:12px;">`
    : "";
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM_LIGHT};color:${INK};font-family:${FONT};font-size:17px;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM_LIGHT};">
<tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:${TEAL};padding:16px 24px;color:${INK};font-size:24px;font-weight:bold;letter-spacing:0.04em;">${logo}<span style="vertical-align:middle;">${escapeHtml(business.businessName.toUpperCase())}</span></td></tr>
<tr><td style="padding:24px;color:${INK};">
${textToHtml(body)}
${textToHtml(signOffText(business))}
</td></tr>
<tr><td style="padding:16px 24px;background:${CREAM_LIGHT};color:${STONE};font-size:14px;line-height:1.5;">${escapeHtml(footerText(business))}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
