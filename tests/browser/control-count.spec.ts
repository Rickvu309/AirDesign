import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { outline, pickShape, shapePanel } from "./shape-turns"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a count takes a typed whole number, steps by a thousand with the arrow keys, and one Undo puts back the whole visit", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await shapePanel(page, shape)
  await pickShape(page, panel, "Rounded rectangle")
  const corner = panel.getByRole("textbox", { name: "Adjust", exact: true })
  await expect(corner).toHaveValue("16667")
  const rounded = await outline(shape)
  await corner.fill("40000")
  await corner.press("Enter")
  await expect(corner).toHaveValue("40000")
  await expect.poll(() => outline(shape)).not.toBe(rounded)
  await corner.press("ArrowUp")
  await expect(corner).toHaveValue("41000")
  await corner.fill("2.5")
  await corner.press("Enter")
  await expect(corner).toHaveValue("41000")
  await page.getByRole("button", { name: "Undo shape", exact: true }).click()
  await expect(corner).toHaveValue("16667")
  await expect.poll(() => outline(shape)).toBe(rounded)
})
