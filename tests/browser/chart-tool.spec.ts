import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { chartToolExportName } from "../../scripts/pptx-cases/trait-chart.mjs"
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

test("inserts a chart, edits its data in the Design panel, keeps it through a reload and exports it @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", chartToolExportName)
  await rm(judged, { force: true })
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  const painted = page.locator("[data-slide-paint] svg[data-chart]")
  await expect(painted).toHaveAttribute("data-chart", /^column$/)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  const name = data.getByRole("textbox", { name: chartCopy.series(1), exact: true })
  await name.fill("Revenue")
  await name.press("Enter")
  const first = data.getByRole("textbox", { name: chartCopy.value(1, 1), exact: true })
  await first.fill("7.5")
  await first.press("Enter")
  await data.getByRole("button", { name: chartCopy.types.line, exact: true }).click()
  await expect(painted).toHaveAttribute("data-chart", "line")
  const frame = page
    .locator("[data-slide-paint] [data-canvas-element]")
    .filter({ has: page.locator("svg[data-chart]") })
  await expect(frame).not.toContainText("{")
  await decks.ready()
  await page.reload()
  await decks.ready()
  await expect(painted).toHaveAttribute("data-chart", "line")
  const spot = await frame.boundingBox()
  if (spot === null) throw new Error("no chart")
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(data.getByRole("textbox", { name: chartCopy.series(1), exact: true })).toHaveValue("Revenue")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(chartToolExportName)
  await (await saving).saveAs(file)
  const [xml, ...more] = await chartParts(file)
  expect(more).toHaveLength(0)
  expect(xml).toContain("<c:lineChart>")
  expect(xml).toContain("<c:v>Revenue</c:v>")
  expect(xml).toContain("<c:v>7.5</c:v>")
  await copyFile(file, judged)
})
