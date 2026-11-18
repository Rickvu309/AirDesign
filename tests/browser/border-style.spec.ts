import { appearanceCopy } from "../../apps/web/src/copy/appearance-copy"
import { borderCopy, borderWords } from "../../apps/web/src/copy/border-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { actualSize } from "./paint-scale"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, settled, unfold } from "./design-panel"
import { partsOf, shapeAt } from "./shape-fills"
import { fillWords } from "../../apps/web/src/copy/fill-copy.ts"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"

const exportName = "exported-border-style.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide1.xml"
const rectangleBorder =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="76200"><a:prstDash val="lgDash"/></a:ln></p:spPr><p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="15000"/></a:schemeClr></a:lnRef>'
const connectorLine =
  '<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="28575"><a:tailEnd type="triangle" w="lg" len="med"/></a:ln></p:spPr><p:style><a:lnRef idx="1">'

test.use({ viewport: { width: 1600, height: 1000 } })

type Stroke = { readonly width: string | null; readonly dash: string | null; readonly tail: string | null }

function stroked(shape: Locator): Promise<Stroke> {
  return shape.evaluate((node) => {
    const drawn = node.querySelector(
      "[data-canvas-line] > rect, [data-canvas-line] > line, [data-canvas-line] g > path",
    )
    return {
      width: drawn?.getAttribute("stroke-width") ?? null,
      dash: drawn?.getAttribute("stroke-dasharray") ?? null,
      tail: drawn?.getAttribute("marker-end") ?? null,
    }
  })
}

function borderSection(panel: Locator): Locator {
  return panel.locator(`[data-design-section="${appearanceCopy.border}"]`)
}

async function design(page: Page): Promise<Locator> {
  const button = page.getByRole("button", { name: transitionCopy.design, exact: true })
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click()
  const panel = page.locator("[data-design-element]")
  return panel
}

async function pickShape(page: Page, shape: Locator): Promise<Locator> {
  const panel = await design(page)
  await shape.click({ position: { x: 4, y: 4 } })
  await unfold(panel, appearanceCopy.border)
  await expect(borderSection(panel)).toBeVisible()
  return borderSection(panel)
}

async function pickConnector(page: Page, connector: Locator): Promise<Locator> {
  const panel = await design(page)
  const box = await connector.boundingBox()
  if (box === null) throw new Error("no connector")
  await page.mouse.click(box.x + box.width / 2, box.y)
  await expect(panel).toHaveAttribute("data-design-element", /\.6$/)
  await unfold(panel, appearanceCopy.border)
  return borderSection(panel)
}

async function choose(section: Locator, label: string, option: string) {
  await section.getByRole("combobox", { name: label, exact: true }).click()
  await section.page().getByRole("option", { name: option, exact: true }).click()
}

test("a person widens and dashes a border that comes from its style and puts an arrowhead on a line, all in the one Border section, and the border survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "shapes-added.pptx")
  await actualSize(page)
  const rectangle = shapeAt(page, "4")
  const connector = shapeAt(page, "6")
  const before = await stroked(rectangle)
  const border = await pickShape(page, rectangle)
  await expect(
    border.getByRole("group", { name: appearanceCopy.border, exact: true }).getByRole("button", {
      name: borderWords["border.solid"],
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true")
  const width = border.getByRole("textbox", { name: borderCopy.width, exact: true })
  await expect(width).toHaveValue("1")
  const kind = border.getByRole("combobox", { name: borderCopy.color, exact: true })
  await expect(kind).toHaveText(new RegExp(`^${fillWords.solid}`))
  await kind.click()
  for (const name of [fillWords.none, fillWords.solid, fillWords.gradient, fillWords.pattern])
    await expect(page.getByRole("option", { name, exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(border.getByRole("group", { name: borderCopy.color, exact: true })).toHaveCount(0)
  await expect(border.getByRole("combobox", { name: borderCopy.dash, exact: true })).toHaveText(/^Solid/)
  const cap = border.getByRole("combobox", { name: borderCopy.cap, exact: true })
  const joined = border.getByRole("combobox", { name: borderCopy.join, exact: true })
  await expect(cap).toHaveText(new RegExp(`^${borderWords.flat}`))
  await expect(joined).toHaveText(new RegExp(`^${borderWords.round}`))
  await expect(cap).toHaveClass(/text-quiet/)
  await expect(joined).toHaveClass(/text-quiet/)
  await expect(border.getByRole("group", { name: borderCopy.head, exact: true })).toHaveCount(0)
  await expect(border.getByRole("group", { name: borderCopy.tail, exact: true })).toHaveCount(0)
  await choose(border, borderCopy.cap, borderWords.sq)
  await expect(cap).toHaveText(new RegExp(`^${borderWords.sq}`))
  await expect(cap).not.toHaveClass(/text-quiet/)
  await border.getByRole("button", { name: borderCopy.reset.cap, exact: true }).click()
  await expect(cap).toHaveText(new RegExp(`^${borderWords.flat}`))
  await expect(cap).toHaveClass(/text-quiet/)
  await cap.click()
  await expect(page.getByRole("option", { name: borderWords.flat, exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await width.fill("6")
  await width.press("Enter")
  await expect.poll(async () => (await stroked(rectangle)).width).not.toBe(before.width)
  await choose(border, borderCopy.dash, borderWords.lgDash)
  await expect.poll(async () => (await stroked(rectangle)).dash).not.toBeNull()
  await expect(border.getByRole("combobox", { name: borderCopy.dash, exact: true })).toHaveText(/^Long dash/)
  const styled = await stroked(rectangle)

  const ends = await pickConnector(page, connector)
  await expect(ends.getByRole("group", { name: borderCopy.head, exact: true })).toBeVisible()
  const tail = ends.getByRole("group", { name: borderCopy.tail, exact: true })
  await expect(tail.getByText(borderCopy.tail, { exact: true })).toBeVisible()
  await expect(tail.getByRole("combobox", { name: borderWords["tail.type"], exact: true })).toHaveText(
    new RegExp(`^${fillWords.none}`),
  )
  await choose(tail, borderWords["tail.type"], borderWords.triangle)
  await expect.poll(async () => (await stroked(connector)).tail).toMatch(/url\(#.+-tail\)/)
  const large = tail.getByRole("combobox", { name: borderWords["tail.width"], exact: true })
  await choose(tail, borderWords["tail.width"], borderWords.lg)
  await expect(large).toHaveText(new RegExp(`^${borderWords.lg}`))
  await page.getByRole("button", { name: undoCopy.undoNamed.border, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed.border, exact: true }).click()
  await expect.poll(async () => (await stroked(connector)).tail).toBeNull()
  await expect(large).not.toHaveText(new RegExp(`^${borderWords.lg}`))
  await page.getByRole("button", { name: undoCopy.redoNamed.border, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.redoNamed.border, exact: true }).click()
  await expect(large).toHaveText(new RegExp(`^${borderWords.lg}`))
  await expect.poll(async () => (await stroked(connector)).tail).toMatch(/url\(#.+-tail\)/)

  await page.reload()
  await settled(page)
  await actualSize(page)
  await expect.poll(() => stroked(shapeAt(page, "4"))).toEqual(styled)
  await expect.poll(async () => (await stroked(shapeAt(page, "6"))).tail).toMatch(/url\(#.+-tail\)/)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain(rectangleBorder)
  expect(slide).toContain(connectorLine)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await actualSize(page)
  await expect.poll(() => stroked(shapeAt(page, "4"))).toEqual(styled)
  await expect.poll(async () => (await stroked(shapeAt(page, "6"))).tail).toMatch(/url\(#.+-tail\)/)
})
