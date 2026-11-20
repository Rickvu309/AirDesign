import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck, typeColor } from "./design-panel"
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

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

test("styles a picked row's cells from the Design panel and the export carries the fill, bold and alignment @export", async ({
  page,
  decks,
}, testInfo) => {
  await openDeck(page, "table-added.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await page.getByRole("button", { name: tableCopy.row(1), exact: true }).click()
  const cells = page.locator("[data-table-cells]")
  await expect(cells.getByRole("heading", { name: tableCopy.cells, exact: true })).toBeVisible()
  await cells.getByRole("button", { name: tableCopy.bold, exact: true }).click()
  await cells.getByLabel(tableCopy.align, { exact: true }).getByRole("button").nth(1).click()
  await typeColor(page, cells.getByLabel(tableCopy.cellFill, { exact: true }).getByRole("button").first(), "1F4E79")
  const header = table.locator('[data-table-cell="0.0"]')
  await expect.poll(() => header.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(31, 78, 121)")
  await expect
    .poll(() => header.evaluate((node) => getComputedStyle(node.querySelector("span") ?? node).fontWeight))
    .toBe("700")
  await expect(table.locator('[data-table-cell="1.0"]')).not.toHaveCSS("background-color", "rgb(31, 78, 121)")
  await page.reload()
  await decks.ready()
  await expect.poll(() => header.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(31, 78, 121)")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("table-cell-style.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  const rows = [...xml.matchAll(/<a:tr [^>]*>.*?<\/a:tr>/g)].map((found) => found[0])
  expect(rows[0]).toContain('<a:srgbClr val="1F4E79"/>')
  expect(rows[0]).toMatch(/<a:rPr[^>]*\bb="1"/)
  expect(rows[0]).toContain('algn="ctr"')
  expect(rows[1]).not.toContain('val="1F4E79"')
})
