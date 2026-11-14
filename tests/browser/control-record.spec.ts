import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a record changes one of its fields, keeps the others, and Undo puts that field back", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await fillPanel(page, shape)
  await panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Pattern" }).click()
  const pattern = panel.getByRole("group", { name: "Pattern", exact: true })
  const foreground = pattern.getByRole("group", { name: "Foreground", exact: true })
  const background = pattern.getByRole("group", { name: "Background", exact: true })
  await expect(foreground.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(background.getByRole("button", { name: "Light 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  const before = await filled(shape)
  await background.getByRole("button", { name: "Dark 2", exact: true }).click()
  await expect.poll(() => filled(shape)).not.toBe(before)
  await expect(background.getByRole("button", { name: "Dark 2", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(foreground.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await pattern.getByRole("combobox", { name: "Pattern" }).click()
  await page.getByRole("option", { name: "Diagonal cross", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^Diagonal cross/)
  await expect(background.getByRole("button", { name: "Dark 2", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(pattern.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await expect(background.getByRole("button", { name: "Dark 2", exact: true })).toHaveAttribute("aria-pressed", "true")
})
