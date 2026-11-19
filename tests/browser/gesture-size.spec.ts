import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { boxTurnedExportName, boxTurnedXfrm } from "../../scripts/pptx-cases/box.mjs"
import { tableResizedExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { designing, unfold, openDeck, settled, storedRows } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { importTitleDeck } from "./new-deck"
import { historicalTable } from "./historical-table"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

type Box = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const slideWidth = 12_192_000

test.use({ viewport: { width: 1470, height: 923 } })

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

async function lastBox(page: Page): Promise<unknown> {
  const boxes = (await storedRows(page)).filter((row) => row.property === "box")
  return boxes.at(-1)?.value ?? null
}

async function dragGrip(page: Page, grip: Locator, by: { readonly x: number; readonly y: number }): Promise<void> {
  const bounds = await grip.boundingBox()
  if (bounds === null) throw new Error("no grip")
  const from = { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function exported(page: Page, file: string): Promise<string> {
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  return slideXml(file)
}

test("a turned shape resizes by its corner, keeps the opposite corner on screen and exports turned @export", async ({
  page,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", boxTurnedExportName)
  await rm(judged, { force: true })
  await openDeck(page, "clean.pptx")
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const rotation = panel.getByRole("textbox", { name: "Rotation", exact: true })
  await rotation.fill("30")
  await rotation.press("Enter")
  const frame = page.locator("[data-slide-paint] [data-selection]")
  await expect(frame).toHaveCSS("transform", /matrix\(0\.866/)
  const grips = frame.locator("[data-grip]")
  await expect(grips).toHaveCount(12)
  const painted = await page.locator("[data-slide-paint]").boundingBox()
  if (painted === null) throw new Error("no slide")
  const twentieth = painted.width / 20
  await dragGrip(page, frame.locator('[data-grip="bottom-right"]'), { x: twentieth, y: -twentieth / 2 })
  await expect.poll(() => lastBox(page)).toEqual({ x: 574_236, y: 589_182, cx: 5_861_929, cy: 1_260_035 })
  await page.reload()
  await settled(page)
  const file = testInfo.outputPath(boxTurnedExportName)
  const xml = await exported(page, file)
  expect(xml).toContain(boxTurnedXfrm)
  await copyFile(file, judged)
})

test("a table resizes by its corner and by Width, scales its columns and rows, and exports at the size kept @export", async ({
  page,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableResizedExportName)
  await rm(judged, { force: true })
  await historicalTable(page)
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await table.click()
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, boxCopy.section)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  const emu = (pixels: number) => Math.round((pixels * slideWidth) / slide.width)
  const x = panel.getByRole("textbox", { name: "X", exact: true })
  const y = panel.getByRole("textbox", { name: "Y", exact: true })
  const width = panel.getByRole("textbox", { name: "Width", exact: true })
  const height = panel.getByRole("textbox", { name: "Height", exact: true })
  await expect(width).toHaveValue("576")
  await expect(height).toHaveValue("87.6")
  const start = { x: Number(await x.inputValue()) * 12_700, y: Number(await y.inputValue()) * 12_700 }
  await dragGrip(page, page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]'), {
    x: 40,
    y: 20,
  })
  const dragged: Box = { ...start, cx: 7_315_200 + emu(40), cy: 1_112_520 + emu(20) }
  await expect.poll(() => lastBox(page)).toEqual(dragged)
  await width.fill("432")
  await width.press("Enter")
  await expect.poll(() => lastBox(page)).toEqual({ ...dragged, cx: 5_486_400 })
  const columns = await table.evaluate((node: HTMLElement) => node.style.gridTemplateColumns)
  for (const column of columns.split(" "))
    expect(Number.parseFloat(column)).toBeCloseTo((5_486_400 / 3) * (slide.width / slideWidth), 1)
  await page.getByRole("button", { name: "Undo resize", exact: true }).click()
  await expect(width).toHaveValue(String(Math.round((dragged.cx / 12_700) * 10) / 10))
  await page.reload()
  await settled(page)
  await expect(table).toContainText("Region")
  const file = testInfo.outputPath(tableResizedExportName)
  const xml = await exported(page, file)
  expect(xml).toContain(`<a:off x="${dragged.x}" y="${dragged.y}"/><a:ext cx="${dragged.cx}" cy="${dragged.cy}"/>`)
  const widths = [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((found) => Number(found[1]))
  const heights = [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((found) => Number(found[1]))
  expect(widths.reduce((sum, each) => sum + each, 0)).toBe(dragged.cx)
  expect(heights.reduce((sum, each) => sum + each, 0)).toBe(dragged.cy)
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  expect(xml).toContain("<a:t>Region</a:t>")
  await copyFile(file, judged)
})
