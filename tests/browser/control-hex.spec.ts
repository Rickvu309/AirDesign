import { designCopy } from "../../apps/web/src/copy/design-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { expect, test } from "@playwright/test"
import { colorWords } from "./color-words"
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
  const names = await colorWords("shapes-added.pptx")
  const edited = await colorWords("shapes-added.pptx", { slots: { accent1: red } })
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const theme = page.locator("[data-template-style-dialog]")
  const accent = theme.getByRole("button", { name: names.accent1, exact: true })
  for (const slot of [
    "dk1",
    "lt1",
    "dk2",
    "lt2",
    "accent1",
    "accent2",
    "accent3",
    "accent4",
    "accent5",
    "accent6",
    "hlink",
    "folHlink",
  ] as const)
    await expect(theme.getByRole("button", { name: names[slot], exact: true })).toBeVisible()
  await expect(accent).toHaveAttribute("title", new RegExp(`#${grey}`, "i"))
  const rectangle = shapeAt(page, "4")
  const before = await filled(rectangle)
  expect(before).not.toBe(painted)
  await typeColor(page, accent, `#${red}`)
  await expect.poll(() => filled(rectangle)).toBe(painted)
  await expect(theme.getByRole("button", { name: edited.accent1, exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${red}`, "i"),
  )
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed["template-color"], exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(before)
  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const restored = page.locator("[data-template-style-dialog]")
  await expect(restored.getByRole("button", { name: names.accent1, exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${grey}`, "i"),
  )
  await restored.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.redoNamed["template-color"], exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(painted)
  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(painted)
})
