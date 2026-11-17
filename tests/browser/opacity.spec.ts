import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, pickColor, settled, shownColor } from "./design-panel"
import { fillPanel, filled, partsOf, shapeAt } from "./shape-fills"

const styleExport = "exported-opacity.pptx"
const textExport = "exported-opacity-text.pptx"
const slidePart = "ppt/slides/slide1.xml"
const styleFaded =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent2"><a:alpha val="60000"/></a:schemeClr></a:solidFill><a:ln><a:solidFill><a:schemeClr val="accent1"><a:shade val="15000"/><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:ln></p:spPr><p:style>'
const ovalFaded =
  '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:alpha val="60000"/></a:schemeClr></a:solidFill><a:ln><a:solidFill><a:schemeClr val="accent1"><a:shade val="15000"/><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:ln></p:spPr><p:style>'
const connectorFaded =
  '<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="28575"><a:solidFill><a:schemeClr val="accent1"><a:alpha val="40000"/></a:schemeClr></a:solidFill></a:ln></p:spPr>'
const textFaded =
  '<a:solidFill><a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"><a:alpha val="50000"/></a:schemeClr></a:solidFill></a:rPr>'

test.use({ viewport: { width: 1470, height: 923 } })

function stroke(shape: Locator): Promise<string | null> {
  return shape.evaluate(
    (node) =>
      node
        .querySelector("[data-canvas-line] > rect, [data-canvas-line] > line, [data-canvas-line] g > path")
        ?.getAttribute("stroke") ?? null,
  )
}

function inked(shape: Locator): Promise<string> {
  return shape.evaluate((node) => {
    const run = [...node.querySelectorAll("span")].find((span) => span.textContent === "Hello")
    return run === undefined ? "" : getComputedStyle(run).color
  })
}

async function pick(page: Page, id: string, connector = false): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  const panel = page.locator("[data-design-element]")
  const shape = shapeAt(page, id)
  if (connector) {
    const box = await shape.boundingBox()
    if (box === null) throw new Error("no connector")
    await page.mouse.click(box.x + box.width / 2, box.y)
  } else await shape.click({ position: { x: 4, y: 4 } })
  await expect(panel).toHaveAttribute("data-design-element", new RegExp(`\\.${id}$`))
  const field = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })
  await expect(field).toBeVisible()
  return field
}

async function opacity(input: Locator, percent: string) {
  await input.fill(percent)
  await input.press("Enter")
  await expect(input).toHaveValue(percent)
}

test("a person fades a shape whose fill and line come from its style, and a line, and the opacity survives Undo, a new color, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", styleExport)
  await rm(judged, { force: true })
  await openDeck(page, "shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const connector = shapeAt(page, "6")
  const solid = await filled(rectangle)
  const edge = await stroke(rectangle)
  const shown = await pick(page, "4")
  await expect(shown).toHaveValue("100")
  await opacity(shown, "60")
  await expect.poll(() => filled(rectangle)).toMatch(/^rgba\(.+, 0\.6\)$/)
  await expect.poll(() => stroke(rectangle)).toMatch(/^#[0-9A-F]{6}99$/i)
  await page.getByRole("button", { name: "Undo opacity", exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(solid)
  await expect.poll(() => stroke(rectangle)).toBe(edge)
  await expect(shown).toHaveValue("100")
  await page.getByRole("button", { name: "Redo opacity", exact: true }).click()
  await expect(shown).toHaveValue("60")
  await expect.poll(() => filled(rectangle)).toMatch(/^rgba\(.+, 0\.6\)$/)
  const accentOne = await filled(rectangle)

  const panel = await fillPanel(page, rectangle)
  const colors = panel.getByRole("group", { name: fillWords.color, exact: true })
  await expect(shownColor(colors)).toHaveText("Accent 1")
  await pickColor(page, colors, "Accent 2")
  await expect.poll(() => filled(rectangle)).not.toBe(accentOne)
  await expect.poll(() => filled(rectangle)).toMatch(/^rgba\(.+, 0\.6\)$/)
  await expect(shown).toHaveValue("60")
  const faded = await filled(rectangle)

  const oval = shapeAt(page, "5")
  await opacity(await pick(page, "5"), "60")
  await expect.poll(() => filled(oval)).toMatch(/^rgba\(.+, 0\.6\)$/)

  const line = await pick(page, "6", true)
  await expect(line).toHaveValue("100")
  await opacity(line, "40")
  await expect.poll(() => stroke(connector)).toMatch(/^#[0-9A-F]{6}66$/i)
  const fadedLine = await stroke(connector)

  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(faded)
  await expect.poll(() => stroke(shapeAt(page, "6"))).toBe(fadedLine)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(styleExport)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain(styleFaded)
  expect(slide).toContain(ovalFaded)
  expect(slide).toContain(connectorFaded)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(faded)
  await expect.poll(() => stroke(shapeAt(page, "6"))).toBe(fadedLine)
})

test("a person fades a shape's fill and text together, the text paints faded, and the export writes the alpha on its run @export", async ({
  page,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", textExport)
  await rm(judged, { force: true })
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const ink = await inked(shape)
  expect(ink).toMatch(/^rgb\(/)
  const shown = await pick(page, "2")
  await opacity(shown, "50")
  await expect.poll(() => inked(shape)).toMatch(/^rgba\(.+, 0\.5\d*\)$/)
  await expect.poll(() => filled(shape)).toMatch(/^rgba\(.+, 0\.5\d*\)$/)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(textExport)
  await (await saving).saveAs(file)
  const saved = await partsOf(file)
  expect(saved.get(slidePart)?.toString("utf8") ?? "").toContain(textFaded)
  await copyFile(file, judged)
})

test("a colour picked after Reset fill keeps the opacity shown, through a reload and export", async ({
  page,
}, testInfo) => {
  await openDeck(page, "shapes-added.pptx")
  await opacity(await pick(page, "4"), "60")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("own-alpha.pptx")
  await (await saving).saveAs(file)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const rectangle = shapeAt(page, "4")
  const panel = await fillPanel(page, rectangle)
  await expect(panel.getByRole("textbox", { name: opacityCopy.label, exact: true })).toHaveValue("60")
  await panel.getByRole("button", { name: fillCopy.reset, exact: true }).click()
  await expect.poll(() => filled(rectangle)).not.toMatch(/0\.6\)$/)
  await pickColor(page, panel.getByRole("group", { name: fillWords.color, exact: true }), formatCopy.colors.accent2)
  const after = "rgb(96, 96, 96)"
  await expect.poll(() => filled(rectangle)).toBe(after)
  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(after)
  const exported = page.waitForEvent("download")
  await exportFromDialog(page)
  const result = testInfo.outputPath("reset-picked.pptx")
  await (await exported).saveAs(result)
  const parts = await partsOf(result)
  expect(parts.get(slidePart)?.toString("utf8")).toContain(
    '<a:schemeClr val="accent2"><a:alpha val="100000"/></a:schemeClr>',
  )
})
