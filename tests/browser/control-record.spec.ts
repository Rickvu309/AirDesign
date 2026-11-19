import { expect, test } from "@playwright/test"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { colorWords } from "./color-words"
import { openDeck, pickColor, shownColor } from "./design-panel"
import { boxFillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a record changes one of its fields, keeps the others, and Undo puts that field back", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const names = await colorWords("clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await boxFillPanel(page, shape)
  await panel.getByRole("group", { name: fillCopy.box, exact: true }).getByRole("button", { name: "Pattern" }).click()
  const pattern = panel.getByRole("group", { name: "Pattern", exact: true })
  const foreground = pattern.getByRole("group", { name: "Foreground", exact: true })
  const background = pattern.getByRole("group", { name: "Background", exact: true })
  await expect(shownColor(foreground)).toHaveText(names.accent1)
  await expect(shownColor(background)).not.toHaveText(names.lt1)
  const before = await filled(shape)
  await pickColor(page, background, names.accent2)
  await expect.poll(() => filled(shape)).not.toBe(before)
  await expect(shownColor(background)).toHaveText(names.accent2)
  await expect(shownColor(foreground)).toHaveText(names.accent1)
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await pattern.getByRole("combobox", { name: "Pattern" }).click()
  await page.getByRole("option", { name: "Diagonal cross", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^Diagonal cross/)
  await expect(shownColor(background)).toHaveText(names.accent2)
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await expect(shownColor(background)).toHaveText(names.accent2)
})
