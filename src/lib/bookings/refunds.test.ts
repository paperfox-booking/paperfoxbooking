import { describe, expect, it } from "vitest";
import { netPaid } from "./money";
import { cancellationTerms } from "./refunds";

describe("cancellationTerms", () => {
  it("gives the cancellations section, up to the next heading", () => {
    const terms = [
      "## Price and payment",
      "1. Deposits aren't refundable.",
      "## Cancellations",
      "1. Cancellation by the Company\r\n\r\nA full refund.",
      "2. More than six weeks' notice: a £60 fee is kept.",
      "## Force majeure",
      "Nobody is liable.",
    ].join("\n\n");
    expect(cancellationTerms(terms)).toEqual([
      "1. Cancellation by the Company",
      "A full refund.",
      "2. More than six weeks' notice: a £60 fee is kept.",
    ]);
  });

  it("gives everything after the heading when it's the last section", () => {
    expect(cancellationTerms("## Cancelling\n\nOne\n\nTwo")).toEqual([
      "One",
      "Two",
    ]);
  });

  it("gives nothing when the terms have no cancellations heading", () => {
    expect(cancellationTerms("Cancelling is free.\n\n## Other\n\nX")).toEqual(
      [],
    );
  });
});

describe("netPaid", () => {
  it("takes refunds off payments, leaving out removed ones", () => {
    expect(
      netPaid(
        [
          { amount_pence: 6000, deleted_at: null },
          { amount_pence: 13500, deleted_at: null },
          { amount_pence: 999, deleted_at: "2026-10-14T10:00:00Z" },
        ],
        [
          { amount_pence: 13500, deleted_at: null },
          { amount_pence: 6000, deleted_at: "2026-10-14T11:00:00Z" },
        ],
      ),
    ).toBe(6000);
  });
});
