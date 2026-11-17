import { geometryCopy, geometryWords } from "../../apps/web/src/copy/geometry-copy"
import { expect, test } from "@playwright/test"
import { openDeck, settled, unfold } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { outline, pickShape } from "./shape-turns"

test("Corners rounds a rectangle in pixels, agrees with Shape type, persists and returns to square", async ({
  page,
}) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const shape = shapeAt(page, "4")
  await shape.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  const corners = panel.getByRole("textbox", { name: geometryCopy.corners, exact: true })
  const square = await outline(shape)
  await corners.fill("20.5")
  await corners.press("Enter")
  await expect(corners).toHaveValue("20.5")
  await expect.poll(() => outline(shape)).not.toBe(square)
  await corners.press("ArrowUp")
  await expect(corners).toHaveValue("21.5")
  await unfold(panel, geometryCopy.section)
  await expect(panel.locator('[data-control="preset"]')).toContainText(geometryWords.roundRect ?? "")
  await page.reload()
  await settled(page)
  await shape.click({ position: { x: 30, y: 30 } })
  await expect(corners).toHaveValue("21.5")
  await corners.fill("0")
  await corners.press("Enter")
  await expect(corners).toHaveValue("0")
  await expect.poll(() => outline(shape)).toBe(square)
  await pickShape(page, panel, geometryWords.ellipse ?? "")
  await expect(corners).toHaveCount(0)
})
