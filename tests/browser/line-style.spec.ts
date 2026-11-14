import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, settled } from "./design-panel"
import { partsOf, shapeAt } from "./shape-fills"

const exportName = "exported-line-style.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide1.xml"
const rectangleLine =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="76200"><a:prstDash val="lgDash"/></a:ln></p:spPr><p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="15000"/></a:schemeClr></a:lnRef>'
const connectorLine =
  '<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln><a:tailEnd type="triangle" w="lg" len="med"/></a:ln></p:spPr><p:style><a:lnRef idx="1">'

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

function lineSection(panel: Locator): Locator {
  return panel.locator("section").filter({ has: panel.page().getByRole("heading", { name: "Line", exact: true }) })
}

async function design(page: Page): Promise<Locator> {
  const button = page.getByRole("button", { name: "Design", exact: true })
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click()
  const panel = page.locator("[data-design-element]")
  return panel
}

async function pickShape(page: Page, shape: Locator): Promise<Locator> {
  const panel = await design(page)
  await shape.click({ position: { x: 4, y: 4 } })
  await expect(lineSection(panel)).toBeVisible()
  return lineSection(panel)
}

async function pickConnector(page: Page, connector: Locator): Promise<Locator> {
  const panel = await design(page)
  const box = await connector.boundingBox()
  if (box === null) throw new Error("no connector")
  await page.mouse.click(box.x + box.width / 2, box.y)
  await expect(panel).toHaveAttribute("data-design-element", /\.6$/)
  return lineSection(panel)
}

async function choose(section: Locator, label: string, option: string) {
  await section.getByRole("combobox", { name: label, exact: true }).click()
  await section.page().getByRole("option", { name: option, exact: true }).click()
}

test("a person widens and dashes a line that comes from its style and puts an arrowhead on a connector, and the line survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const connector = shapeAt(page, "6")
  const before = await stroked(rectangle)
  const line = await pickShape(page, rectangle)
  const width = line.getByRole("textbox", { name: "Width", exact: true })
  await expect(width).toHaveValue("1")
  await expect(line.getByRole("group", { name: "Line", exact: true }).getByRole("button")).toHaveText([
    "None",
    "Color",
    "Gradient",
    "Pattern",
  ])
  await expect(line.getByRole("combobox", { name: "Dash", exact: true })).toHaveText(/^Solid/)
  await expect(line.getByRole("group", { name: "Cap", exact: true }).getByRole("button")).toHaveText([
    "Flat",
    "Round",
    "Square",
  ])
  await width.fill("6")
  await width.press("Enter")
  await expect.poll(async () => (await stroked(rectangle)).width).not.toBe(before.width)
  await choose(line, "Dash", "Long dash")
  await expect.poll(async () => (await stroked(rectangle)).dash).not.toBeNull()
  await expect(line.getByRole("combobox", { name: "Dash", exact: true })).toHaveText(/^Long dash/)
  const styled = await stroked(rectangle)

  const ends = await pickConnector(page, connector)
  const tail = ends.getByRole("group", { name: "End arrow", exact: true })
  await expect(tail.getByText("End arrow", { exact: true })).toBeVisible()
  await expect(tail.getByRole("combobox", { name: "Arrowhead", exact: true })).toHaveText(/^None/)
  await choose(tail, "Arrowhead", "Triangle")
  await expect.poll(async () => (await stroked(connector)).tail).toMatch(/url\(#.+-tail\)/)
  await tail.getByRole("group", { name: "Width", exact: true }).getByRole("button", { name: "Large" }).click()
  await expect(
    tail.getByRole("group", { name: "Width", exact: true }).getByRole("button", { name: "Large" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Undo line", exact: true }).click()
  await page.getByRole("button", { name: "Undo line", exact: true }).click()
  await expect.poll(async () => (await stroked(connector)).tail).toBeNull()
  await page.getByRole("button", { name: "Redo line", exact: true }).click()
  await page.getByRole("button", { name: "Redo line", exact: true }).click()
  await expect.poll(async () => (await stroked(connector)).tail).toMatch(/url\(#.+-tail\)/)

  await page.reload()
  await settled(page)
  await expect.poll(() => stroked(shapeAt(page, "4"))).toEqual(styled)
  await expect.poll(async () => (await stroked(shapeAt(page, "6"))).tail).toMatch(/url\(#.+-tail\)/)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain(rectangleLine)
  expect(slide).toContain(connectorLine)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect.poll(() => stroked(shapeAt(page, "4"))).toEqual(styled)
  await expect.poll(async () => (await stroked(shapeAt(page, "6"))).tail).toMatch(/url\(#.+-tail\)/)
})
