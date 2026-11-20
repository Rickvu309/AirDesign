import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"
import { test } from "./deck-test"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const slidePart = "ppt/slides/slide1.xml"
const exportName = "exported-element-order.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

test.use({ viewport: { width: 1600, height: 1000 } })

function frame(page: Page, shape: number) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

async function keysOf(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-canvas-element") ?? node.getAttribute("data-thumb-element") ?? ""),
    )
}

async function paintFront(page: Page, front: number, back: number): Promise<void> {
  const mark = (shape: number) => `#${String(shape)}`
  const at = (keys: readonly string[], shape: number) => keys.findIndex((key) => key.endsWith(mark(shape)))
  await expect
    .poll(async () => {
      const keys = await keysOf(page, "[data-slide-paint] [data-canvas-element]")
      return at(keys, front) > at(keys, back)
    })
    .toBe(true)
  await expect
    .poll(async () => {
      const keys = await keysOf(page, "[data-slide-entry='1'] [data-thumb-element]")
      return at(keys, front) > at(keys, back)
    })
    .toBe(true)
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function overlap(page: Page): Promise<void> {
  const back = await frame(page, 4).boundingBox()
  const front = await frame(page, 5).boundingBox()
  if (back === null || front === null) throw new Error("no shape")
  await drag(
    page,
    { x: front.x + front.width * 0.5, y: front.y + front.height * 0.5 },
    { x: back.x + back.width * 0.05 - front.x, y: back.y - front.height * 0.35 - front.y },
  )
  await expect
    .poll(async () => {
      const rect = await frame(page, 4).boundingBox()
      const ellipse = await frame(page, 5).boundingBox()
      if (rect === null || ellipse === null) return false
      const covers = ellipse.y < rect.y + rect.height * 0.45 && ellipse.y + ellipse.height > rect.y + 8
      const clear = ellipse.y + ellipse.height < rect.y + rect.height - 12
      return covers && clear
    })
    .toBe(true)
  await expect(page.getByRole("button", { name: "Undo move", exact: true })).toBeEnabled()
}

function item(page: Page, name: string) {
  return page.getByRole("menuitem", { name })
}

async function openBack(page: Page): Promise<void> {
  const box = await frame(page, 4).boundingBox()
  if (box === null) throw new Error("no rectangle")
  await page.mouse.click(box.x + 20, box.y + box.height - 10, { button: "right" })
}

test("a rectangle moves in front of an ellipse, and back, and the export changes only that slide @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("backward")
  await rm(judged, { force: true })
  await decks.open(fixture)
  await insert(page, "Rectangle")
  await insert(page, "Ellipse")
  await expect(frame(page, 4)).toBeVisible()
  await expect(frame(page, 5)).toBeVisible()
  await overlap(page)
  await paintFront(page, 5, 4)
  await openBack(page)
  await expect(page.getByRole("menuitem")).toHaveCount(9)
  await expect(item(page, "Bring to front")).toBeEnabled()
  await expect(item(page, "Bring forward")).toBeEnabled()
  await expect(item(page, "Send backward")).toBeEnabled()
  await expect(item(page, "Send to back")).toBeEnabled()
  await item(page, "Bring to front").click()
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText("Brought to front")
  await paintFront(page, 4, 5)
  await openBack(page)
  await expect(item(page, "Bring to front")).toBeDisabled()
  await expect(item(page, "Bring forward")).toBeDisabled()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Undo bring to front", exact: true }).click()
  await paintFront(page, 5, 4)
  await page.getByRole("button", { name: "Redo bring to front", exact: true }).click()
  await paintFront(page, 4, 5)
  await frame(page, 4).click()
  await page.keyboard.press("Control+BracketLeft")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText("Sent backward")
  await paintFront(page, 5, 4)
  await page.getByRole("button", { name: "Undo send backward", exact: true }).click()
  await paintFront(page, 4, 5)
  await page.reload()
  await decks.ready()
  await paintFront(page, 4, 5)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([slidePart])
  const xml = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(xml.indexOf('<p:cNvPr id="4"')).toBeGreaterThan(xml.indexOf('<p:cNvPr id="5"'))
  await copyFile(download, judged)
  await decks.open(download)
  await paintFront(page, 4, 5)
})
