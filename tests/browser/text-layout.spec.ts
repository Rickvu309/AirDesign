import { textCopy } from "../../apps/web/src/copy/text-copy"
import { actualSize } from "./paint-scale"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck, settled, unfold } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf, shapeAt } from "./shape-fills"

const typeExport = "exported-text-type.pptx"
const layoutExport = "exported-text-layout.pptx"
const slidePart = "ppt/slides/slide1.xml"
const typed =
  '<a:pPr><a:lnSpc><a:spcPct val="150000"/></a:lnSpc><a:spcBef><a:spcPts val="1200"/></a:spcBef><a:spcAft><a:spcPts val="600"/></a:spcAft></a:pPr><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:latin typeface="Georgia"/></a:rPr><a:t>Hello</a:t></a:r>'
const laidOut =
  '<a:bodyPr lIns="457200" tIns="45720" rIns="91440" bIns="45720" anchor="b" wrap="none" vert="vert270" numCol="2"/>'

test.use({ viewport: { width: 1600, height: 1000 } })

type Shown = {
  readonly font: string
  readonly top: number
  readonly left: number
  readonly lineHeight: string
  readonly writing: string
  readonly columns: string
}

function shown(shape: Locator): Promise<Shown> {
  return shape.evaluate((node) => {
    const run = [...node.querySelectorAll("span")].find((span) => span.textContent === "Hello")
    const frame = node.getBoundingClientRect()
    const box = run?.getBoundingClientRect()
    const layer = run?.closest("[data-paragraph]")?.parentElement?.parentElement
    const body = run?.closest("[data-paragraph]")?.parentElement
    return {
      font: run === undefined ? "" : getComputedStyle(run).fontFamily,
      top: Math.round((box?.top ?? 0) - frame.top),
      left: Math.round((box?.left ?? 0) - frame.left),
      lineHeight: run === undefined ? "" : getComputedStyle(run).lineHeight,
      writing: layer === null || layer === undefined ? "" : getComputedStyle(layer).writingMode,
      columns: body === null || body === undefined ? "" : getComputedStyle(body).columnCount,
    }
  })
}

function section(page: Page, name: string): Locator {
  const panel = page.locator("[data-design-element]")
  return panel.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) })
}

async function typeIn(field: Locator, value: string) {
  await field.fill(value)
  await field.press("Enter")
  await expect(field).toHaveValue(value)
}

async function exported(page: Page, file: string, judged: string) {
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  const saved = await partsOf(file)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)
  return saved.get(slidePart)?.toString("utf8") ?? ""
}

test("a person sets a text box's font, spacing, margins, anchor, wrap, direction and columns, and each survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  const judgedType = join(process.cwd(), "tests/browser", typeExport)
  const judgedLayout = join(process.cwd(), "tests/browser", layoutExport)
  await rm(judgedType, { force: true })
  await rm(judgedLayout, { force: true })
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const shape = shapeAt(page, "2")
  const opening = await shown(shape)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const text = section(page, "Text")
  await expect(text).toBeVisible()
  await typeIn(text.getByRole("textbox", { name: "Font", exact: true }), "Georgia")
  await expect.poll(async () => (await shown(shape)).font).toMatch(/^"?Georgia"?,/)
  await typeIn(text.getByRole("textbox", { name: "Line spacing", exact: true }), "150")
  await expect.poll(async () => (await shown(shape)).lineHeight).not.toBe(opening.lineHeight)
  await unfold(panel, textCopy.paragraphSpacing)
  await typeIn(panel.getByRole("textbox", { name: textCopy.spaceBefore, exact: true }), "12")
  await typeIn(panel.getByRole("textbox", { name: textCopy.spaceAfter, exact: true }), "6")
  await expect.poll(async () => (await shown(shape)).top).toBeGreaterThan(opening.top)
  const spaced = await shown(shape)
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect(panel.getByRole("textbox", { name: textCopy.spaceAfter, exact: true })).toHaveValue("0")
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await expect(panel.getByRole("textbox", { name: textCopy.spaceAfter, exact: true })).toHaveValue("6")
  const type = await exported(page, testInfo.outputPath(typeExport), judgedType)
  expect(type).toContain(typed)

  await unfold(page.locator("[data-design-element]"), "Text box")
  const body = section(page, "Text box")
  const margins = body.getByRole("group", { name: "Margins", exact: true })
  await expect(margins.getByRole("textbox", { name: "Left", exact: true })).toHaveValue("7.2")
  await typeIn(margins.getByRole("textbox", { name: "Left", exact: true }), "36")
  await expect.poll(async () => (await shown(shape)).left).toBeGreaterThan(spaced.left)
  const anchor = body.getByRole("group", { name: "Vertical alignment", exact: true })
  await expect(anchor.getByRole("button", { name: "Top" })).toHaveAttribute("aria-pressed", "true")
  await anchor.getByRole("button", { name: "Bottom" }).click()
  await expect.poll(async () => (await shown(shape)).top).toBeGreaterThan(spaced.top + 40)
  const wrap = body.getByRole("button", { name: "Wrap text", exact: true })
  await expect(wrap).toHaveAttribute("aria-pressed", "true")
  await wrap.click()
  await expect(wrap).toHaveAttribute("aria-pressed", "false")
  await expect(body.getByRole("combobox", { name: "Autofit", exact: true })).toBeEnabled()
  const direction = body.getByRole("group", { name: "Text direction", exact: true })
  await direction.getByRole("button", { name: "Rotate 270°" }).click()
  await expect.poll(async () => (await shown(shape)).writing).toBe("sideways-lr")
  await page.getByRole("button", { name: "Undo text box", exact: true }).click()
  await expect.poll(async () => (await shown(shape)).writing).toBe("horizontal-tb")
  await page.getByRole("button", { name: "Redo text box", exact: true }).click()
  await expect.poll(async () => (await shown(shape)).writing).toBe("sideways-lr")
  await typeIn(body.getByRole("textbox", { name: "Columns", exact: true }), "2")
  await expect.poll(async () => (await shown(shape)).columns).toBe("2")
  const laid = await shown(shape)

  await page.reload()
  await settled(page)
  await actualSize(page)
  await expect.poll(() => shown(shapeAt(page, "2"))).toEqual(laid)
  const layout = await exported(page, testInfo.outputPath(layoutExport), judgedLayout)
  expect(layout).toContain(laidOut)
  expect(layout).toContain(typed)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(testInfo.outputPath(layoutExport))
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await actualSize(page)
  await expect.poll(() => shown(shapeAt(page, "2"))).toEqual(laid)
})
