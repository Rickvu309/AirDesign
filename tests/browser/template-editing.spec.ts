import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck, settled, typeColor } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { filled, partsOf, shapeAt } from "./shape-fills"

const exported = "exported-template-editing.pptx"
const accent = "5"
const coral = "ff6600"

test.use({ viewport: { width: 1600, height: 1000 } })

function themeDialog(page: Page): Locator {
  return page.locator("[data-template-style]")
}

async function paint(page: Page): Promise<string> {
  return filled(shapeAt(page, accent))
}

test("remixes template colours, adds a colour, deletes an unused template, and keeps that through undo, reload and export @export", async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const judged = join(process.cwd(), "tests/browser", exported)
  await rm(judged, { force: true })
  await openDeck(page, "two-templates.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const accentShape = shapeAt(page, accent)
  await expect(accentShape).toBeVisible()
  const before = await paint(page)
  await page.getByRole("button", { name: designCopy.remixTemplateColors, exact: true }).click()
  await expect.poll(() => paint(page)).not.toBe(before)
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => paint(page)).toBe(before)
  await page.getByRole("button", { name: designCopy.remixTemplateColors, exact: true }).click()
  await expect.poll(() => paint(page)).not.toBe(before)
  const remixed = await paint(page)

  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const dialog = themeDialog(page)
  await expect(dialog.getByRole("button", { name: designCopy.templateInUse, exact: true })).toBeDisabled()
  await typeColor(
    page,
    dialog.getByRole("button", { name: designCopy.addTemplateColor, exact: true }),
    colorCopy.hexName(coral),
  )
  await expect(dialog.getByRole("button", { name: "Color 1", exact: true })).toBeVisible()
  await expect(dialog).toContainText(designCopy.addedColorNote)
  await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()

  await page.locator("[data-design-panel] [data-template-style]").click()
  const popup = page.locator('[data-slot="popover-content"]')
  await expect(popup.locator("[data-template-style]")).toHaveCount(2)
  await popup.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).nth(1).click()
  await themeDialog(page).getByRole("button", { name: designCopy.deleteTemplateStyle, exact: true }).click()
  await expect(themeDialog(page)).toHaveCount(0)
  await page.locator("[data-design-panel] [data-template-style]").click()
  await expect(popup.locator("[data-template-style]")).toHaveCount(1)

  await page.reload()
  await settled(page)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect.poll(() => paint(page)).toBe(remixed)
  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  await expect(themeDialog(page).getByRole("button", { name: "Color 1", exact: true })).toBeVisible()
  await themeDialog(page).getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.locator("[data-design-panel] [data-template-style]").click()
  await expect(popup.locator("[data-template-style]")).toHaveCount(1)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = info.outputPath(exported)
  await (await saving).saveAs(file)
  const saved = await partsOf(file)
  expect(saved.has("ppt/theme/theme2.xml")).toBe(false)
  expect(saved.has("ppt/slideMasters/slideMaster2.xml")).toBe(false)
  const theme = saved.get("ppt/theme/theme1.xml")?.toString("utf8") ?? ""
  expect(theme).toContain('<a:custClr name="Color 1"><a:srgbClr val="FF6600"/></a:custClr>')
  const slide = saved.get("ppt/slides/slide1.xml")?.toString("utf8") ?? ""
  expect(slide).toContain('val="accent2"')
  expect(slide).toContain('val="123456"')
  expect(saved.get("[Content_Types].xml")?.toString("utf8") ?? "").not.toContain("theme2.xml")
})
