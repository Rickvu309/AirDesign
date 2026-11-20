import { copyFile, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { tableReadableExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { historicalTable } from "./historical-table"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

async function shown(page: Page, spot: string): Promise<{ text: string; ink: string; ground: string; ratio: number }> {
  const [text, ink, ground] = await page
    .locator(`[data-slide-paint] [data-canvas-table] [data-table-cell="${spot}"]`)
    .evaluate((cell: HTMLElement) => {
      const hex = (css: string) =>
        (css.match(/\d+/g) ?? [])
          .slice(0, 3)
          .map((channel) => Number(channel).toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node !== null && (node.textContent ?? "").trim() === "") node = walker.nextNode()
      const holder = node?.parentElement ?? cell
      return [node?.textContent ?? "", hex(getComputedStyle(holder).color), hex(getComputedStyle(cell).backgroundColor)]
    })
  const { contrast } = await import("../../packages/document/dist/index.js")
  return { text, ink, ground, ratio: contrast(ink, ground) }
}

async function readable(page: Page, spot: string, text: string): Promise<{ ink: string; ground: string }> {
  let last = await shown(page, spot)
  await expect
    .poll(async () => {
      last = await shown(page, spot)
      return last.text === text && last.ratio >= 4.5
    })
    .toBe(true)
  return { ink: last.ink, ground: last.ground }
}

test("preserves a previously edited readable table through reload and native export @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableReadableExportName)
  await rm(judged, { force: true })
  const original = await historicalTable(page, "readable")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await readable(page, "0.0", "Region")
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
  await page.reload()
  await decks.ready()
  await expect(table).toContainText("Region")
  await readable(page, "0.0", "Region")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(tableReadableExportName)
  await (await saving).saveAs(file)
  expect(await readFile(file)).toEqual(original)
  await copyFile(file, judged)
})
