import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator } from "@playwright/test"
import { openDeck } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

test.use({ viewport: { width: 1600, height: 1000 } })

const long = "License cost over five years, in millions of dollars"

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

const heightOf = (locator: Locator) => locator.evaluate((node) => node.getBoundingClientRect().height)

const rowsOf = (table: Locator) =>
  table.evaluate((node) =>
    getComputedStyle(node)
      .gridTemplateRows.split(" ")
      .map((size) => Number.parseFloat(size)),
  )

async function gap(frame: Locator, table: Locator): Promise<number> {
  return Math.abs((await heightOf(frame)) - (await heightOf(table)))
}

test("the frame follows a table's rows as typing grows and shrinks them, and the export writes the rows the canvas shows @export", async ({
  page,
}, testInfo) => {
  await openDeck(page, "table-added.pptx")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  const frame = page.locator("[data-slide-paint] [data-selection]")
  await table.click()
  const start = await heightOf(table)
  expect(await gap(frame, table)).toBeLessThan(1.5)
  await table.locator('[data-table-cell="1.0"]').dblclick()
  await page.keyboard.type(long)
  await expect.poll(() => heightOf(table)).toBeGreaterThan(start + 10)
  await expect.poll(() => gap(frame, table)).toBeLessThan(1.5)
  for (const _ of long) await page.keyboard.press("Backspace")
  await expect.poll(() => heightOf(table)).toBeLessThan(start + 1.5)
  await expect.poll(() => gap(frame, table)).toBeLessThan(1.5)
  await page.keyboard.type(long)
  await page.keyboard.press("Escape")
  await expect.poll(() => gap(frame, table)).toBeLessThan(1.5)
  const painted = await rowsOf(table)
  const slide = await page.locator("[data-slide-paint]").evaluate((node) => node.getBoundingClientRect().width)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("table-row-heights.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  const heights = [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((found) => Number(found[1]))
  const frameHeight = Number(/<p:graphicFrame>.*?<a:ext cx="\d+" cy="(\d+)"/s.exec(xml)?.[1])
  const perPixel = 12_192_000 / slide
  expect(heights).toHaveLength(painted.length)
  heights.forEach((height, at) => expect(Math.abs(height - (painted[at] ?? 0) * perPixel)).toBeLessThan(perPixel))
  expect(frameHeight).toBe(heights.reduce((sum, height) => sum + height, 0))
  expect(heights[1]).toBeGreaterThan(heights[0]!)
})

test("a row border drag stops at the text of the row it shrinks", async ({ page }) => {
  await openDeck(page, "table-added.pptx")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await table.locator('[data-table-cell="1.0"]').dblclick()
  await page.keyboard.type(long)
  await page.keyboard.press("Escape")
  const before = await rowsOf(table)
  const border = table.locator('[data-row-border="1"]').first()
  const spot = await border.boundingBox()
  if (spot === null) throw new Error("no border")
  const x = spot.x + spot.width / 3
  const y = spot.y + spot.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 80, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await rowsOf(table))[1]).toBeGreaterThan((before[1] ?? 0) - 1)
  const after = await rowsOf(table)
  expect(Math.abs((after[2] ?? 0) - (before[2] ?? 0))).toBeLessThan(1.5)
})
