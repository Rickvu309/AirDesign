import { slideListCopy } from "../../bin/product-copy.mjs"
import { openGroupDeck } from "../grid-group-add.mjs"

export async function hiddenGrid(kit) {
  const account = await openGroupDeck(kit, 5)
  const { page, expect } = kit
  const numbers = page.locator("[data-slide-number]")
  await numbers.nth(1).click()
  await numbers.nth(2).click({ modifiers: ["ControlOrMeta"] })
  await page.locator('[data-slide-entry="2"]').click({ button: "right" })
  const skip = page.getByRole("menuitem", { name: slideListCopy.skipSet(2), exact: true })
  await expect(page.getByRole("menu")).toBeVisible()
  if (await skip.count()) {
    await skip.click()
    await expect(page.locator("[data-slide-skip-mark]")).toHaveCount(2)
  } else {
    await page.keyboard.press("Escape")
    for (const index of [2, 3]) {
      const entry = page.locator(`[data-slide-entry="${index}"]`)
      await numbers.nth(index - 1).click()
      await entry.click({ button: "right" })
      await page.getByRole("menuitem", { name: slideListCopy.skip, exact: true }).click()
      await expect(entry).toHaveAttribute("data-slide-skipped", "true")
    }
    await numbers.nth(1).click()
    await numbers.nth(2).click({ modifiers: ["ControlOrMeta"] })
  }
  await page.mouse.move(1400, 70)
  return account
}

export default {
  name: "slide-grid-hidden",
  design: "/screens/s41-01-editor-grid-default",
  drive: hiddenGrid,
}
