import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { outline, shapePanel, shapeType, typeGrid } from "./shape-turns"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Shape type shows every preset as a named thumbnail, arrows move through the grid, Enter picks, and Undo puts the shape back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await shapePanel(page, shape)
  await expect(shapeType(panel)).toHaveText(/^Rectangle/)
  await expect(shapeType(panel).locator("svg").first()).toBeVisible()
  const before = await outline(shape)

  await shapeType(panel).click()
  const grid = typeGrid(page)
  const thumbs = grid.getByRole("button")
  await expect(thumbs).toHaveCount(55)
  await expect(thumbs.locator("svg")).toHaveCount(55)
  await expect(thumbs.nth(1)).toHaveAccessibleName("Rounded rectangle")
  await expect(grid.getByRole("button", { name: "Rectangle", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(grid.getByRole("button", { name: "Rectangle", exact: true })).toBeFocused()

  await page.keyboard.press("ArrowRight")
  await expect(grid.getByRole("button", { name: "Rounded rectangle", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(grid.getByRole("button", { name: "Rectangle", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  const below = (await thumbs.nth(11).getAttribute("aria-label")) ?? ""
  await expect(thumbs.nth(11)).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(grid.getByRole("button", { name: "Rectangle", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await expect(grid).toHaveCount(0)
  await expect(shapeType(panel)).toHaveText(new RegExp(`^${below}`))
  await expect.poll(() => outline(shape)).not.toBe(before)
  await expect(shapeType(panel)).toBeFocused()

  await page.getByRole("button", { name: "Undo shape", exact: true }).click()
  await expect(shapeType(panel)).toHaveText(/^Rectangle/)
  await expect.poll(() => outline(shape)).toBe(before)
})
