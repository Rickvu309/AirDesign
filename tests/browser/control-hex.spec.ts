import { expect, test } from "@playwright/test"
import { openDeck, settled, typeColor } from "./design-panel"
import { filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

const painted = "rgb(192, 0, 0)"
const red = "c00000"
const grey = "505050"

test("a theme colour takes a picked hex colour, every shape that names it repaints, and Undo puts the colour back", async ({
  page,
}) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator("[data-template-style]").click()
  const theme = page.locator("[data-design-theme]")
  const accent = theme.getByRole("button", { name: "Accent 1", exact: true })
  await expect(theme.locator('[data-control="hex"]')).toHaveCount(12)
  await expect(accent).toHaveAttribute("title", new RegExp(`#${grey}`, "i"))
  const rectangle = shapeAt(page, "4")
  const before = await filled(rectangle)
  expect(before).not.toBe(painted)
  await typeColor(page, accent, `#${red}`)
  await expect.poll(() => filled(rectangle)).toBe(painted)
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${red}`, "i"),
  )
  await page.getByRole("button", { name: "Undo theme color", exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(before)
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${grey}`, "i"),
  )
  await page.getByRole("button", { name: "Redo theme color", exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(painted)
  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(painted)
})
