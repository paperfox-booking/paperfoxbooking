import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes values with commas, quotes and new lines", () => {
    expect(
      toCsv([
        ["Name", "Notes"],
        ["Jo Smith", 'Sits with "Sam", near the door\nNo stairs'],
      ]),
    ).toBe(
      '﻿Name,Notes\r\nJo Smith,"Sits with ""Sam"", near the door\nNo stairs"\r\n',
    );
  });

  it("stops text being treated as a formula, but leaves numbers alone", () => {
    expect(
      toCsv([["=SUM(A1:A9)", "+44 7700", "-5+1", "-5", "-12.50", -5, "@me"]]),
    ).toBe("﻿'=SUM(A1:A9),'+44 7700,'-5+1,-5,-12.50,-5,'@me\r\n");
  });

  it("writes yes and no, and leaves empty values empty", () => {
    expect(toCsv([[true, false, null, undefined, 0]])).toBe("﻿Yes,No,,,0\r\n");
  });
});
