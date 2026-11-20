import { copyFile, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { tableCellsExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { historicalTable } from "./historical-table"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

test("preserves a previously edited cells table through reload and native export @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableCellsExportName)
  await rm(judged, { force: true })
  const original = await historicalTable(page, "cells")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await page.reload()
  await decks.ready()
  await expect(table).toContainText("Region")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(tableCellsExportName)
  await (await saving).saveAs(file)
  expect(await readFile(file)).toEqual(original)
  await copyFile(file, judged)
})
