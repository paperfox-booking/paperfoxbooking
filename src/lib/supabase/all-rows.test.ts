import { describe, expect, it } from "vitest";
import { allRows } from "./all-rows";

describe("allRows", () => {
  it("reads every page until a short one", async () => {
    const data = Array.from({ length: 7 }, (_, index) => index);
    const asked: [number, number][] = [];
    const rows = await allRows(async (from, to) => {
      asked.push([from, to]);
      return { data: data.slice(from, to + 1), error: null };
    }, 3);
    expect(rows).toEqual(data);
    expect(asked).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
  });

  it("stops after a full last page when the next is empty", async () => {
    const rows = await allRows(
      async (from) => ({ data: from === 0 ? [1, 2] : [], error: null }),
      2,
    );
    expect(rows).toEqual([1, 2]);
  });

  it("passes errors on", async () => {
    await expect(
      allRows(async () => ({ data: null, error: { message: "Nope" } })),
    ).rejects.toThrow("Nope");
  });
});
