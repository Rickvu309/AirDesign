import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx")

test.use({ viewport: { width: 1600, height: 1000 } })

test("an imported merged table paints locked cells rather than a grey box and exports byte for byte", async ({
  page,
  decks,
}, testInfo) => {
  await decks.open(deck)
  await page.locator('[data-slide-entry="11"]').click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toHaveCount(1)
  await expect(table).toContainText("Objectives:")
  await expect(table).toContainText("Class A:")
  await expect(table.locator('[contenteditable="true"],[tabindex="0"]')).toHaveCount(0)
  await expect(table).toHaveAttribute("contenteditable", "false")
  const look = await table.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    cells: node.querySelectorAll("[data-table-cell]").length,
  }))
  expect(look.background).toBe("rgba(0, 0, 0, 0)")
  expect(look.cells).toBe(7)
  const layout = await table.evaluate((node) => {
    const cells = [...node.querySelectorAll<HTMLElement>("[data-table-cell]")]
    return cells.map((cell) => {
      const text = cell.firstElementChild as HTMLElement
      const body = text.firstElementChild as HTMLElement
      const bounds = cell.getBoundingClientRect()
      const content = body.getBoundingClientRect()
      const style = getComputedStyle(text)
      return {
        cell: cell.dataset.tableCell,
        bottom: bounds.bottom,
        textBottom: content.bottom + parseFloat(style.paddingBottom),
        paddingLeft: parseFloat(style.paddingLeft),
      }
    })
  })
  for (const cell of layout) {
    expect(cell.textBottom, `cell ${cell.cell} text fits its row`).toBeLessThanOrEqual(cell.bottom + 1)
    expect(cell.paddingLeft).toBeGreaterThan(0)
  }
  await expect(page.locator('[data-slide-entry="11"] [data-canvas-table]')).toHaveCount(1)
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const saved = testInfo.outputPath("untouched-table.pptx")
  await (await download).saveAs(saved)
  expect(await readFile(saved)).toEqual(await readFile(deck))
  await page.reload()
  await page.locator('[data-slide-entry="11"]').click()
  await expect(table).toContainText("Objectives:")
})

test("narrow table cells wrap unbroken numbers rather than painting over adjacent cells", async ({ page, decks }) => {
  await decks.open(join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-roman-thermal-runtime.pptx"))
  await page.locator('[data-slide-entry="10"]').click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("54.45")
  const overflow = await table
    .locator("[data-table-cell]")
    .evaluateAll((cells) =>
      cells
        .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => cell.getAttribute("data-table-cell")),
    )
  expect(overflow).toEqual([])
})
