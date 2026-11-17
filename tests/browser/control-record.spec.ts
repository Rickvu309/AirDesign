import { expect, test } from "@playwright/test"
import { openDeck, pickColor, shownColor, setPanelMode } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a record changes one of its fields, keeps the others, and Undo puts that field back", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await fillPanel(page, shape)
  await setPanelMode(page, "design")
  await panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Pattern" }).click()
  const pattern = panel.getByRole("group", { name: "Pattern", exact: true })
  const foreground = pattern.getByRole("group", { name: "Foreground", exact: true })
  const background = pattern.getByRole("group", { name: "Background", exact: true })
  await expect(shownColor(foreground)).toHaveText("Accent 1")
  await expect(shownColor(background)).not.toHaveText("Light 1")
  const before = await filled(shape)
  await pickColor(page, background, "Accent 2")
  await expect.poll(() => filled(shape)).not.toBe(before)
  await expect(shownColor(background)).toHaveText("Accent 2")
  await expect(shownColor(foreground)).toHaveText("Accent 1")
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await pattern.getByRole("combobox", { name: "Pattern" }).click()
  await page.getByRole("option", { name: "Diagonal cross", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^Diagonal cross/)
  await expect(shownColor(background)).toHaveText("Accent 2")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await expect(shownColor(background)).toHaveText("Accent 2")
})
