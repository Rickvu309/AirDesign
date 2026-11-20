import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { chartImportedExportName } from "../../scripts/pptx-cases/chart-imported.mjs"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const original = join(process.cwd(), "scripts/pptx-fixtures/census-updating-spm.pptx")

async function changedCharts(file: string): Promise<readonly string[]> {
  const read = async (path: string) => {
    const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(path))))
    const parts = new Map<string, string>()
    for (const entry of await reader.getEntries())
      if (/^ppt\/(charts|embeddings)\//.test(entry.filename))
        parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())).toString("base64"))
    await reader.close()
    return parts
  }
  const [before, after] = [await read(original), await read(file)]
  return [...after.keys()].filter((name) => before.get(name) !== after.get(name))
}

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

test("selects an imported PowerPoint pie, moves it, and edits its numbers in place @export", async ({
  page,
  decks,
}, testInfo) => {
  await decks.open(original)
  await entry(page, 19).click()
  const pies = page.locator("[data-slide-paint] svg[data-chart=pie]")
  await expect(pies).toHaveCount(3)
  const spot = await pies.last().boundingBox()
  if (spot === null) throw new Error("no pie")
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Shift+ArrowUp")
  await expect.poll(async () => Math.round((await pies.last().boundingBox())?.y ?? 0)).toBeLessThan(Math.round(spot.y))
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  await expect(data.getByRole("button", { name: chartCopy.types.pie, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const value = data.getByRole("textbox", { name: chartCopy.value(1, 1), exact: true })
  await value.fill("42")
  await value.press("Enter")
  await expect(value).toHaveValue("42")
  await expect(page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: "Under 18" })).toHaveCount(1)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(chartImportedExportName)
  await (await saving).saveAs(file)
  const changed = await changedCharts(file)
  expect(changed.filter((name) => name.endsWith(".xml") && !name.includes("_rels"))).toHaveLength(1)
  expect(changed.filter((name) => name.endsWith(".xlsx"))).toHaveLength(1)
  await copyFile(file, join(process.cwd(), "tests/browser", chartImportedExportName))
})
