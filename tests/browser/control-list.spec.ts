import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a list adds an item and removes one within its bounds, and Undo brings the removed item back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await fillPanel(page, shape)
  await panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Gradient" }).click()
  const stops = panel.getByRole("list", { name: "Stops" }).getByRole("listitem")
  await expect(stops).toHaveCount(2)
  await expect(panel.getByRole("button", { name: /^Remove stop/ })).toHaveCount(0)
  const two = await filled(shape)
  await panel.getByRole("button", { name: "Add stop", exact: true }).click()
  await expect(stops).toHaveCount(3)
  await expect.poll(() => filled(shape)).not.toBe(two)
  await panel
    .getByRole("group", { name: "Stop 2", exact: true })
    .getByRole("button", { name: "Accent 3", exact: true })
    .click()
  await expect.poll(() => filled(shape)).not.toBe(two)
  const three = await filled(shape)
  await panel.getByRole("button", { name: "Remove stop 2", exact: true }).click()
  await expect(stops).toHaveCount(2)
  await expect.poll(() => filled(shape)).toBe(two)
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(stops).toHaveCount(3)
  await expect.poll(() => filled(shape)).toBe(three)
})
