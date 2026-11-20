import { copyFile, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { tableExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { historicalTable } from "./historical-table"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

test("preserves a previously edited typed table through reload and native export @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableExportName)
  await rm(judged, { force: true })
  const original = await historicalTable(page, "typed")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
  await page.reload()
  await decks.ready()
  await expect(table).toContainText("Region")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(tableExportName)
  await (await saving).saveAs(file)
  expect(await readFile(file)).toEqual(original)
  await copyFile(file, judged)
})
