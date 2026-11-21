import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { chartWaterfallExportName } from "../../scripts/pptx-cases/chart-waterfall.mjs"
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

async function chartPart(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => /^ppt\/charts\/chart\d+\.xml$/.test(item.filename))
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("chart part")
  return new TextDecoder().decode(bytes)
}

async function typeValue(data: Locator, row: number, text: string) {
  const cell = data.getByRole("textbox", { name: chartCopy.value(row, 1), exact: true })
  await cell.fill(text)
  await cell.press("Enter")
  await expect(cell).toHaveValue(text)
}

test("inserts a waterfall, edits its changes and totals in the Data grid, keeps them through a reload and exports a native bridge @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", chartWaterfallExportName)
  await rm(judged, { force: true })
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.waterfall, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveAttribute("data-chart", /^column$/)
  const label = (text: string) =>
    canvas.locator("[data-chart-text]").filter({ hasText: new RegExp(`^${text.replace("+", "\\+")}$`) })
  for (const text of ["100", "+12", "-14", "125"]) await expect(label(text)).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  await expect(data.getByRole("button", { name: chartCopy.types.waterfall, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const total = (row: number) => data.getByRole("checkbox", { name: chartCopy.totalRow(row), exact: true })
  await expect(total(6)).toBeChecked()
  await expect(total(3)).not.toBeChecked()
  await typeValue(data, 3, "20")
  await typeValue(data, 6, "127")
  await expect(label("+20")).toHaveCount(1)
  await total(4).click()
  await expect(label("9")).toHaveCount(1)
  await total(4).click()
  await expect(label("+9")).toHaveCount(1)
  await expect(label("127")).toHaveCount(1)
  await decks.ready()
  await page.reload()
  await decks.ready()
  await expect(label("+20")).toHaveCount(1)
  await expect(label("127")).toHaveCount(1)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(chartWaterfallExportName)
  await (await saving).saveAs(file)
  const xml = await chartPart(file)
  expect(xml.match(/<c:ser>/g)).toHaveLength(4)
  expect(xml).toContain('<c:grouping val="stacked"/>')
  expect(xml).toContain("<c:v>127</c:v>")
  await copyFile(file, judged)
})
