import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { lineCopy } from "../../apps/web/src/copy/line-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { colorPickerExport, colorPickerWritten } from "../../scripts/pptx-cases/color-picker.mjs"
import { designing, openDeck, picker, settled, shownColor, typeColor } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { fillPanel, filled, partsOf, shapeAt } from "./shape-fills"

const judged = join(process.cwd(), "tests/browser", colorPickerExport)
const slidePart = "ppt/slides/slide1.xml"
const deckParts = ["[Content_Types].xml", "ppt/_rels/presentation.xml.rels", "ppt/presentation.xml"]
const hash = "#"
const navy = "rgb(31, 78, 121)"
const tint = colorCopy.lighter(formatCopy.colors.accent1, 40)
const darker = colorCopy.darker(formatCopy.colors.accent2, 50)

async function nudge(page: Page, swatch: Locator): Promise<void> {
  const at = (await swatch.getAttribute("data-at")) ?? "0,0"
  const column = Number(at.split(",")[0])
  const [away, back] = column === 5 ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"]
  await swatch.focus()
  await page.keyboard.press(away)
  await page.keyboard.press(back)
  await expect(swatch).toBeFocused()
}

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
  const others = picker(page).getByRole("group", { name: colorCopy.others, exact: true })
  const used = others.getByRole("button", { name: colorCopy.hexName("1F4E79"), exact: true })
  await expect(used).toHaveCount(1)
  await used.click()
  await page.keyboard.press("Escape")
  await expect(shownColor(field)).toBeFocused()
  await expect.poll(() => filled(rectangle)).toBe(navy)
  await expect(shownColor(field)).toHaveText(`${hash}1F4E79`)
  await undone(page, rectangle, field, accent, "Accent 1")
  await expect.poll(() => filled(rectangle)).toBe(navy)

  await shownColor(field).click()
  await picker(page).getByRole("button", { name: colorCopy.add, exact: true }).click()
  await picker(page).getByRole("button", { name: colorCopy.moreTints, exact: true }).click()
  await picker(page).getByRole("button", { name: tint, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(picker(page)).toHaveCount(0)
  await expect.poll(() => filled(rectangle)).not.toBe(navy)
  const tinted = await filled(rectangle)
  expect(tinted).not.toBe(accent)
  const tintHex = (await shownColor(field).innerText()).trim()
  expect(tintHex).toMatch(/^#[0-9A-F]{6}$/)
  await shownColor(field).click()
  await picker(page).getByRole("button", { name: colorCopy.add, exact: true }).click()
  await expect(picker(page).getByRole("button", { name: tint, exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await undone(page, rectangle, field, navy, `${hash}1F4E79`)
  await expect.poll(() => filled(rectangle)).toBe(tinted)

  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(tinted)
  await expect.poll(() => filled(shapeAt(page, "5"))).toBe(navy)
  panel = await fillPanel(page, shapeAt(page, "4"))
  await expect(shownColor(panel.getByRole("group", { name: "Color", exact: true }))).toHaveText(tintHex)

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
    await expect
      .poll(() =>
        page
          .locator("[data-slide-paint] [data-run]")
          .first()
          .evaluate((node) => getComputedStyle(node).color),
      )
      .toBe(opacity === "100" ? "rgb(0, 0, 0)" : "rgba(0, 0, 0, 0.1)")
    const before = await page
      .locator("[data-slide-paint] [data-run]")
      .first()
      .evaluate((node) => getComputedStyle(node).color)
    const field = panel.getByRole("group", { name: "Text color" })
    await expect(shownColor(field)).toHaveText(formatCopy.colors.dk1)
    await shownColor(field).click()
    await expect(picker(page)).not.toContainText(/Contrast|Passes AA|Fails AA/)
    await picker(page).getByRole("button", { name: colorCopy.add, exact: true }).click()
    await picker(page).getByRole("button", { name: colorCopy.moreTints, exact: true }).click()
    const swatch = picker(page).getByRole("button", { name: darker, exact: true })
    await nudge(page, swatch)
    await page.keyboard.press(slideListCopy.openKey)
    await expect(picker(page)).not.toContainText(/Contrast|Passes AA|Fails AA/)
    await page.keyboard.press("Escape")
    await expect(shownColor(field)).toBeFocused()
    const run = page.locator("[data-slide-paint] [data-run]").first()
    await expect
      .poll(() => run.evaluate((node) => getComputedStyle(node).color))
      .toBe(opacity === "100" ? "rgb(26, 26, 77)" : "rgba(26, 26, 77, 0.1)")
    await expect(shownColor(field)).toHaveText(/^#[0-9A-F]{6}$/)
    await page.getByRole("button", { name: "Undo text format", exact: true }).click()
    await expect.poll(() => run.evaluate((node) => getComputedStyle(node).color)).toBe(before)
  })
}

test("arrow keys move through the template colours and Escape returns focus to the row", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  const panel = await fillPanel(page, shapeAt(page, "5"))
  const field = panel.getByRole("group", { name: lineCopy.color, exact: true })
  const row = shownColor(field)
  await row.click()
  const accent = picker(page).getByRole("button", { name: formatCopy.colors.accent2, exact: true })
  await nudge(page, accent)
  await page.keyboard.press(slideListCopy.openKey)
  await page.keyboard.press("Escape")
  await expect(picker(page)).toHaveCount(0)
  await expect(row).toBeFocused()
  await expect(row).toHaveText(formatCopy.colors.accent2)
})
