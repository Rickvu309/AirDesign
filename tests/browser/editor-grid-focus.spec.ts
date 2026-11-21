import { expect } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { clean, entry, openGrid } from "./slide-grid-deck"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("two quick Deletes in the grid leave focus on the slide that takes their place, so the next key still moves it", async ({
  page,
  decks,
}) => {
  await decks.open(clean)
  await openGrid(page)
  for (const count of [2, 3, 4]) {
    await page.getByRole("button", { name: slideListCopy.newSlide, exact: true }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
  }
  await page.keyboard.press("Home")
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 1)).toBeFocused()
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 2")
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
})
