import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { chartTypesExportName } from "../../scripts/pptx-cases/chart-types.mjs"
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

async function chartParts(file: string): Promise<string[]> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const found: string[] = []
  for (const entry of await reader.getEntries())
    if (/^ppt\/charts\/chart\d+\.xml$/.test(entry.filename))
      found.push(new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter())))
  await reader.close()
  return found
}

async function insert(page: Page, kind: keyof typeof chartCopy.kinds, count: number) {
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds[kind], exact: true }).click()
  await expect(page.locator("[data-slide-paint] svg[data-chart]")).toHaveCount(count)
}

test("inserts stacked, 100% stacked and horizontal bar charts, keeps them through a reload and exports them natively @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", chartTypesExportName)
  await rm(judged, { force: true })
  await openDeck(page, "blank.pptx")
  const painted = page.locator("[data-slide-paint] svg[data-chart]")
  await insert(page, "stacked", 1)
  await expect(painted).toHaveAttribute("data-chart", /^column$/)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const labels = page.locator("[data-chart-settings]").getByRole("checkbox", { name: chartCopy.labels, exact: true })
  await labels.click()
  await expect(labels).toBeChecked()
  await expect(page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: /^4\.9$/ })).toHaveCount(1)
  const data = page.locator("[data-chart-data]")
  await expect(data.getByRole("button", { name: chartCopy.types.stacked, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await insert(page, "bar", 2)
  await data.getByRole("button", { name: chartCopy.types.horizontal, exact: true }).click()
  await expect(painted.nth(1)).toHaveAttribute("data-chart", "bar")
  await insert(page, "stacked100", 3)
  await expect(data.getByRole("button", { name: chartCopy.types.stacked100, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: /^100%$/ })).toHaveCount(1)
  await decks.ready()
  await page.reload()
  await decks.ready()
  await expect(painted).toHaveCount(3)
  await expect(painted.nth(1)).toHaveAttribute("data-chart", "bar")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(chartTypesExportName)
  await (await saving).saveAs(file)
  const xml = (await chartParts(file)).join("\n")
  expect(xml).toContain('<c:barDir val="col"/><c:grouping val="stacked"/>')
  expect(xml).toContain('<c:barDir val="col"/><c:grouping val="percentStacked"/>')
  expect(xml).toContain('<c:barDir val="bar"/><c:grouping val="clustered"/>')
  expect(xml.match(/<c:overlap val="100"\/>/g)).toHaveLength(2)
  expect(xml).toContain('<c:dLblPos val="ctr"/>')
  await copyFile(file, judged)
})
