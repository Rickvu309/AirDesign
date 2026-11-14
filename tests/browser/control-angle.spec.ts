import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an angle takes a typed number in degrees, refuses a full turn, and Undo puts it back", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await fillPanel(page, shape)
  await panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Gradient" }).click()
  const angle = panel.getByRole("textbox", { name: "Angle" })
  await expect(angle).toHaveValue("90")
  const down = await filled(shape)
  await angle.fill("0")
  await angle.press("Enter")
  await expect(angle).toHaveValue("0")
  await expect.poll(() => filled(shape)).not.toBe(down)
  await angle.fill("360")
  await angle.press("Enter")
  await expect(angle).toHaveValue("0")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(angle).toHaveValue("90")
  await expect.poll(() => filled(shape)).toBe(down)
})
