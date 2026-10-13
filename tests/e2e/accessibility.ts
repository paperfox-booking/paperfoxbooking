import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Fails the test if axe finds any WCAG 2.2 A or AA problem on the page.
 * Frames are left out: the only ones are email previews, sandboxed frames
 * showing an email, which axe can't look inside. (Its default mode would
 * also open a helper page to combine results from frames, which hangs.)
 */
export async function expectNoAccessibilityProblems(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .options({ iframes: false })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const problems = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`,
  );
  expect(problems).toEqual([]);
}
