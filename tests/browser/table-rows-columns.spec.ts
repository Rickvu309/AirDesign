import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { tableRowsColumnsExportName } from "../../scripts/pptx-cases/trait-table.mjs"
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

test.use({ viewport: { width: 1470, height: 923 } })

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

test("adds, inserts, deletes and resizes a new table's rows and columns, and exports them @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableRowsColumnsExportName)
  await rm(judged, { force: true })
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(2, 2), exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  await page.getByRole("button", { name: tableCopy.addColumn, exact: true }).click()
  await expect(table).toHaveAttribute("aria-colcount", "3")
  await page.getByRole("button", { name: tableCopy.addRow, exact: true }).click()
  await expect(table).toHaveAttribute("aria-rowcount", "3")
  await page.getByRole("button", { name: tableCopy.insertRow(1), exact: true }).click()
  await expect(table).toHaveAttribute("aria-rowcount", "4")
  const row = page.getByRole("button", { name: tableCopy.row(4), exact: true })
  await row.click()
  await row.press("Delete")
  await expect(table).toHaveAttribute("aria-rowcount", "3")
  await expect(table).toHaveCount(1)
  const border = table.locator('[data-column-border="0"]').first()
  const spot = await border.boundingBox()
  if (spot === null) throw new Error("no border")
  const before = await table.evaluate((node: HTMLElement) => node.style.gridTemplateColumns)
  await page.mouse.move(spot.x + spot.width / 2, spot.y + 4)
  await page.mouse.down()
  await page.mouse.move(spot.x + spot.width / 2 + 40, spot.y + 4, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => table.evaluate((node: HTMLElement) => node.style.gridTemplateColumns)).not.toBe(before)
  await page.reload()
  await decks.ready()
  await expect(table).toHaveAttribute("aria-colcount", "3")
  await expect(table).toHaveAttribute("aria-rowcount", "3")
  await expect(table.locator('[data-table-cell="0.0"]')).toContainText("Region")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(tableRowsColumnsExportName)
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  const widths = [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((found) => Number(found[1]))
  expect(widths).toHaveLength(3)
  expect(widths[0]).toBeGreaterThan(widths[1] ?? 0)
  expect([...xml.matchAll(/<a:tr h="/g)]).toHaveLength(3)
  await copyFile(file, judged)
})
