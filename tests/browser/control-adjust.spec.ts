import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { outline, pickShape, shapePanel, shapeType } from "./shape-turns"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an adjust lists the picked preset's own adjusts at their defaults, and a new preset starts from its own", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await shapePanel(page, shape)
  await expect(shapeType(panel)).toHaveText(/^Rectangle/)
  await expect(panel.locator('[data-control="adjust"]')).toHaveCount(0)
  await pickShape(page, panel, "Right arrow")
  const adjusts = panel.getByRole("group", { name: "Adjust", exact: true })
  await expect(adjusts.getByRole("textbox")).toHaveCount(2)
  await expect(adjusts.getByRole("textbox", { name: "Adjust 1" })).toHaveValue("50000")
  await expect(adjusts.getByRole("textbox", { name: "Adjust 2" })).toHaveValue("50000")
  const arrow = await outline(shape)
  await adjusts.getByRole("textbox", { name: "Adjust 1" }).fill("80000")
  await adjusts.getByRole("textbox", { name: "Adjust 1" }).press("Enter")
  await expect.poll(() => outline(shape)).not.toBe(arrow)
  await expect(adjusts.getByRole("textbox", { name: "Adjust 2" })).toHaveValue("50000")
  await pickShape(page, panel, "Triangle")
  await expect(adjusts.getByRole("textbox")).toHaveCount(1)
  await expect(adjusts.getByRole("textbox", { name: "Adjust", exact: true })).toHaveValue("50000")
  await page.getByRole("button", { name: "Undo shape", exact: true }).click()
  await expect(shapeType(panel)).toHaveText(/^Right arrow/)
  await expect(adjusts.getByRole("textbox", { name: "Adjust 1" })).toHaveValue("80000")
})
