import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { chartSettingsExportName } from "../../scripts/pptx-cases/chart-settings.mjs"
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

test.use({ viewport: { width: 1470, height: 923 } })

async function chartPart(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => /^ppt\/charts\/chart\d+\.xml$/.test(item.filename))
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("chart part")
  return new TextDecoder().decode(bytes)
}

test("sets a chart's title, data labels, axis, gridlines, gap, colour and legend, keeps them through a reload and exports them natively @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", chartSettingsExportName)
  await rm(judged, { force: true })
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveAttribute("data-chart", /^column$/)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const settings = page.locator("[data-chart-settings]")
  const title = settings.getByRole("textbox", { name: chartCopy.title, exact: true })
  await title.fill("Revenue grows every quarter")
  await title.press("Enter")
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "Revenue grows every quarter" })).toHaveCount(1)
  for (const [name, on] of [
    [chartCopy.labels, true],
    [chartCopy.axis, false],
    [chartCopy.gridlines, false],
  ] as const) {
    const box = settings.getByRole("checkbox", { name, exact: true })
    await box.click()
    await expect(box).toBeChecked({ checked: on })
  }
  await settings.getByRole("combobox", { name: chartCopy.format, exact: true }).click()
  await page.getByRole("option", { name: chartCopy.formats["$#,##0.0"], exact: true }).click()
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "$4.1" })).toHaveCount(1)
  await settings.getByRole("combobox", { name: chartCopy.legend, exact: true }).click()
  await page.getByRole("option", { name: chartCopy.legends.top, exact: true }).click()
  const gap = settings.getByRole("textbox", { name: chartCopy.gap })
  await gap.fill("40")
  await gap.press("Enter")
  const navy = "1F4E79"
  await typeColor(page, settings.getByLabel("Series 1", { exact: true }).getByRole("button").first(), navy)
  await expect(canvas.locator(`svg[data-chart] [fill="#${navy}"]`).first()).toBeVisible()
  await expect(settings.getByRole("checkbox", { name: chartCopy.gridlines, exact: true })).not.toBeChecked()
  await page.reload()
  await decks.ready()
  const frame = canvas.locator("[data-canvas-element]").filter({ has: page.locator("svg[data-chart]") })
  const spot = await frame.boundingBox()
  if (spot === null) throw new Error("no chart")
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(settings.getByRole("textbox", { name: chartCopy.title, exact: true })).toHaveValue(
    "Revenue grows every quarter",
  )
  await expect(settings.getByRole("checkbox", { name: chartCopy.labels, exact: true })).toBeChecked()
  await expect(settings.getByRole("checkbox", { name: chartCopy.axis, exact: true })).not.toBeChecked()
  await expect(settings.getByRole("combobox", { name: chartCopy.legend, exact: true })).toContainText(
    chartCopy.legends.top,
  )
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(chartSettingsExportName)
  await (await saving).saveAs(file)
  const xml = await chartPart(file)
  expect(xml).toContain("<a:t>Revenue grows every quarter</a:t>")
  expect(xml).toContain('<c:numFmt formatCode="$#,##0.0" sourceLinked="0"/>')
  expect(xml).toContain('<c:showVal val="1"/>')
  expect(xml).toContain(
    '<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/>',
  )
  expect(xml).not.toContain("<c:majorGridlines>")
  expect(xml).toContain('<c:gapWidth val="40"/>')
  expect(xml).toContain('<c:legendPos val="t"/>')
  expect(xml).toContain('<a:srgbClr val="1F4E79"/>')
  await copyFile(file, judged)
})
