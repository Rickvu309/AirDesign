import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { colorPickerExport, colorPickerWritten } from "../../scripts/pptx-cases/color-picker.mjs"
import { designing, openDeck, picker, pickColor, settled, shownColor, typeColor } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { fillPanel, filled, partsOf, shapeAt } from "./shape-fills"

const judged = join(process.cwd(), "tests/browser", colorPickerExport)
const slidePart = "ppt/slides/slide1.xml"
const deckParts = ["[Content_Types].xml", "ppt/_rels/presentation.xml.rels", "ppt/presentation.xml"]
const hash = "#"
const navy = "rgb(31, 78, 121)"
const tint = "Accent 1, lighter 40%"

test.use({ viewport: { width: 1600, height: 1000 } })

async function undone(page: Page, shape: Locator, field: Locator, before: string, name: string) {
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect.poll(() => filled(shape)).toBe(before)
  await expect(shownColor(field)).toHaveText(name)
  await page.getByRole("button", { name: "Redo fill", exact: true }).click()
}

test("a person picks a hex colour, a colour already in the deck and a theme tint, undoes each, and the export writes the rgb and the slot with lumMod and lumOff @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const oval = shapeAt(page, "5")
  const accent = await filled(oval)

  let panel = await fillPanel(page, oval)
  let field = panel.getByRole("group", { name: "Color", exact: true })
  await expect(shownColor(field)).toHaveText("Accent 1")
  await typeColor(page, shownColor(field), "1f4e79")
  await expect.poll(() => filled(oval)).toBe(navy)
  await expect(shownColor(field)).toHaveText(`${hash}1F4E79`)
  await undone(page, oval, field, accent, "Accent 1")
  await expect.poll(() => filled(oval)).toBe(navy)

  panel = await fillPanel(page, rectangle)
  field = panel.getByRole("group", { name: "Color", exact: true })
  await shownColor(field).click()
  await expect(picker(page).getByRole("group", { name: "In this deck" }).getByRole("button")).toHaveCount(1)
  await picker(page)
    .getByRole("group", { name: "In this deck" })
    .getByRole("button", { name: `${hash}1F4E79` })
    .click()
  await page.keyboard.press("Escape")
  await expect.poll(() => filled(rectangle)).toBe(navy)
  await expect(shownColor(field)).toHaveText(`${hash}1F4E79`)
  await undone(page, rectangle, field, accent, "Accent 1")
  await expect.poll(() => filled(rectangle)).toBe(navy)

  await pickColor(page, field, tint)
  await expect.poll(() => filled(rectangle)).not.toBe(navy)
  const tinted = await filled(rectangle)
  expect(tinted).not.toBe(accent)
  await expect(shownColor(field)).toHaveText(tint)
  await shownColor(field).click()
  await expect(picker(page).getByRole("button", { name: tint, exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await undone(page, rectangle, field, navy, `${hash}1F4E79`)
  await expect.poll(() => filled(rectangle)).toBe(tinted)

  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(tinted)
  await expect.poll(() => filled(shapeAt(page, "5"))).toBe(navy)
  panel = await fillPanel(page, shapeAt(page, "4"))
  await expect(shownColor(panel.getByRole("group", { name: "Color", exact: true }))).toHaveText(tint)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(colorPickerExport)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  for (const written of colorPickerWritten) expect(slide).toContain(written)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name).filter((name) => !deckParts.includes(name))).toEqual([slidePart])
  await copyFile(file, judged)
})

for (const opacity of ["100", "10"]) {
  test(`a ${opacity}% text colour picker omits unsupported contrast claims and a theme tint paints the text at once`, async ({
    page,
  }) => {
    await openDeck(page, "clean.pptx")
    const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
    const panel = await designing(page, editor)
    const opacityField = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })
    await opacityField.fill(opacity)
    await opacityField.press(slideListCopy.openKey)
    const field = panel.getByRole("group", { name: "Text color" })
    await shownColor(field).click()
    await expect(picker(page)).not.toContainText(/Contrast|Passes AA|Fails AA/)
    const swatch = picker(page).getByRole("button", { name: "Accent 2, darker 50%", exact: true })
    await swatch.focus()
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowLeft")
    await expect(swatch).toBeFocused()
    await page.keyboard.press(slideListCopy.openKey)
    await expect(picker(page)).not.toContainText(/Contrast|Passes AA|Fails AA/)
    await page.keyboard.press("Escape")
    const run = page.locator("[data-slide-paint] [data-run]").first()
    await expect(run).toHaveAttribute("data-color", new RegExp("^scheme:accent2 lumMod:50000"))
    await expect
      .poll(() => run.evaluate((node) => getComputedStyle(node).color))
      .toBe(opacity === "100" ? "rgb(26, 26, 77)" : "rgba(26, 26, 77, 0.1)")
    await expect(shownColor(field)).toHaveText("Accent 2, darker 50%")
    await page.getByRole("button", { name: "Undo text format", exact: true }).click()
    await expect(run).not.toHaveAttribute("data-color", /accent2/)
  })
}
