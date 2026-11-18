import { designCopy } from "../../apps/web/src/copy/design-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { themeCopy } from "../../apps/web/src/copy/theme-copy"
import { expect, test } from "@playwright/test"
import { openDeck, settled, typeColor } from "./design-panel"
import { filled, shapeAt } from "./shape-fills"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const painted = "rgb(192, 0, 0)"
const red = "c00000"
const grey = "505050"

test("a theme colour takes a picked hex colour, every shape that names it repaints, and Undo puts the colour back", async ({
  page,
}) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const theme = page.locator("[data-design-theme]")
  const accent = theme.getByRole("button", { name: themeCopy.accent1, exact: true })
  for (const name of [
    themeCopy.dk1,
    themeCopy.lt1,
    themeCopy.dk2,
    themeCopy.lt2,
    themeCopy.accent1,
    themeCopy.accent2,
    themeCopy.accent3,
    themeCopy.accent4,
    themeCopy.accent5,
    themeCopy.accent6,
    themeCopy.hlink,
    themeCopy.folHlink,
  ])
    await expect(theme.getByRole("button", { name, exact: true })).toBeVisible()
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
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed["theme-color"], exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(before)
  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const restored = page.locator("[data-design-theme]")
  await expect(restored.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${grey}`, "i"),
  )
  await restored.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.redoNamed["theme-color"], exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(painted)
  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(painted)
})
