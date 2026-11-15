import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a percent takes a typed number in percent, steps with the arrow keys, and one Undo puts back the whole visit", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await fillPanel(page, shape)
  await panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Gradient" }).click()
  const position = panel.getByRole("group", { name: "Stop 2", exact: true }).getByRole("textbox", { name: "Position" })
  await expect(position).toHaveValue("100")
  const before = await filled(shape)
  await position.fill("60")
  await position.press("Enter")
  await expect(position).toHaveValue("60")
  await expect.poll(() => filled(shape)).toContain("60%")
  await position.press("ArrowDown")
  await expect(position).toHaveValue("59")
  await position.fill("140")
  await position.press("Enter")
  await expect(position).toHaveValue("59")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(position).toHaveValue("100")
  await expect.poll(() => filled(shape)).toBe(before)
})
