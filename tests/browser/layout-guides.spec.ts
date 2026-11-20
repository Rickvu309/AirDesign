import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { guideCopy } from "../../apps/web/src/copy/guide-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { test } from "./deck-test"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"

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
const exportName = "exported-layout-guides.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/census-updating-spm.pptx")
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

function painted(page: Page) {
  return page.locator("[data-slide-paint] [data-layout-guides]")
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a person adds a layout guide in design mode, turns it into columns, hides and shows it, and the export keeps it @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("layout-guides")
  await rm(judged, { force: true })
  await decks.open(fixture)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.keyboard.press("Shift+D")
  const section = page.locator(`[data-design-section="${guideCopy.layoutGuide}"]`)
  await section.getByRole("button", { name: guideCopy.add }).click()
  await expect(painted(page).locator('[data-layout-guide="grid"]')).toHaveCount(1)
  const tenPoints = `10 ${designCopy.points}`
  const [gridPattern, columnsPattern] = Object.keys(guideCopy.patterns) as (keyof typeof guideCopy.patterns)[]
  if (gridPattern === undefined || columnsPattern === undefined) throw new Error("patterns")
  const grid = guideCopy.named(gridPattern, 5, tenPoints)
  await section.getByRole("button", { name: guideCopy.settings(grid) }).click()
  const settings = page.locator("[data-layout-guide-settings]")
  await settings.getByRole("button", { name: guideCopy.patterns.columns, exact: true }).click()
  await expect(painted(page).locator('[data-layout-guide="columns"] rect')).toHaveCount(5)
  await page.keyboard.press("Escape")
  const columns = guideCopy.named(columnsPattern, 5, tenPoints)
  await section.getByRole("button", { name: guideCopy.hide(columns) }).click()
  await expect(painted(page)).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["layout-guide"], exact: true }).click()
  await expect(painted(page).locator('[data-layout-guide="columns"] rect')).toHaveCount(5)

  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Shift+G")
  await expect(painted(page)).toHaveCount(0)
  await page.keyboard.press("Control+Shift+Digit4")
  await expect(painted(page)).toHaveCount(1)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemcheckbox", { name: guideCopy.layoutGuides }).click()
  await expect(painted(page)).toHaveCount(0)
  await page.reload()
  await decks.ready()
  await expect(painted(page)).toHaveCount(0)
  await page.keyboard.press("Shift+G")
  await expect(painted(page).locator('[data-layout-guide="columns"] rect')).toHaveCount(5)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const saved = await partsOf(download)
  expect(saved.get("ppt/slides/slide1.xml")?.toString("utf8")).toContain('pattern="columns"')
  await copyFile(download, judged)
})
