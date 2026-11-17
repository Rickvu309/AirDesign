import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { entry, fixtures, openFile, openGrid, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a section collapses to its heading, stays collapsed for the deck, and opens again for the slide a person goes to", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  const numbers = page.locator("[data-editor-grid]").getByRole("button", { name: /^Numbers/ })
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(numbers).toHaveAccessibleName("Numbers 2 slides")
  await numbers.click()
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await expect(entry(page, 2)).toHaveCount(0)
  await expect(entry(page, 3)).toHaveCount(0)
  await expect(numbers).toContainText("2 slides")
  await numbers.press(slideListCopy.openKey)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 3)).toBeVisible()
  await numbers.press("Space")
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await expect(entry(page, 3)).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAttribute("tabindex", "0")
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await entry(page, 3).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 3)).toBeFocused()
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
})
