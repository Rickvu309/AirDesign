import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { tableCellsExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { forward, settled, signInBrowser, test } from "./api-stack"
import { fixtures } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf } from "./shape-fills"

const slidePart = "ppt/slides/slide1.xml"
const words = (text: string) => [{ from: 0, runs: [{ from: 0, text }] }]
const blank = [{ from: 0, runs: [] }]
const accent1 = { solid: { scheme: "accent1" } }

test.use({ viewport: { width: 1600, height: 1000 } })

async function openTable(page: Page): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(fixtures, "table-added.pptx"))
  await page.waitForFunction(() => /^\/deck\/[A-Za-z0-9_-]{1,64}$/.test(location.pathname))
  await settled(page)
  return new URL(page.url()).pathname.slice("/deck/".length)
}

function cellFill(page: Page, spot: string): Promise<string> {
  return page
    .locator(`[data-slide-paint] [data-canvas-table] [data-table-cell="${spot}"]`)
    .evaluate((cell: HTMLElement) => getComputedStyle(cell).backgroundColor)
}

function cellProperties(xml: string): readonly string[] {
  return [...xml.matchAll(/<a:tcPr>(.*?)<\/a:tcPr>/g)].map((found) => found[1] ?? "")
}

test("an agent fills a table's header row, a person fills and borders the next row in the panel, and the export keeps both @export", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", tableCellsExportName)
  await rm(judged, { force: true })
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openTable(page)
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)).index)
    .toBe("ready")
  const before = await cellFill(page, "0.0")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const value = JSON.stringify({
    rows: [
      { from: 0, cells: [words("Region"), words("Sales"), blank], fills: [accent1, accent1, accent1] },
      { from: 1, cells: [blank, blank, blank] },
      { from: 2, cells: [blank, blank, blank] },
    ],
  })
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ op: "set", target: "256.4", table: { value } }] },
    cookie,
  )
  expect(edited).toMatchObject({ ok: true })
  await expect.poll(() => cellFill(page, "0.2")).not.toBe(before)
  const header = await cellFill(page, "0.0")

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="1.0"]').click()
  await page.keyboard.press("Escape")
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("textbox", { name: "Row 2, column 1" }).focus()
  await panel.getByRole("group", { name: "Apply to", exact: true }).getByRole("button", { name: "Row" }).click()
  const fill = panel.getByRole("group", { name: "Cell fill", exact: true })
  await fill.getByRole("button", { name: "Color", exact: true }).click()
  await panel
    .getByRole("group", { name: "Color", exact: true })
    .first()
    .getByRole("button", { name: "Accent 2" })
    .click()
  await expect.poll(() => cellFill(page, "1.2")).not.toBe(before)
  const filled = await cellFill(page, "1.2")
  expect(filled).not.toBe(header)
  await panel.getByRole("combobox", { name: "Borders", exact: true }).click()
  await page.getByRole("option", { name: "Bottom", exact: true }).click()
  const bottom = () =>
    page.locator('[data-slide-paint] [data-canvas-table] [data-table-cell="1.1"] line').nth(3).getAttribute("stroke")
  const thin = await bottom()
  const border = panel.getByRole("group", { name: "Border color", exact: true })
  await border.getByRole("button", { name: "Color", exact: true }).click()
  await expect.poll(bottom).not.toBe(thin)
  const bordered = await bottom()

  await page.getByRole("button", { name: "Undo border", exact: true }).click()
  await expect.poll(bottom).toBe(thin)
  await page.getByRole("button", { name: "Redo border", exact: true }).click()
  await expect.poll(bottom).toBe(bordered)
  await page.reload()
  await settled(page)
  await expect.poll(() => cellFill(page, "0.1")).toBe(header)
  await expect.poll(() => cellFill(page, "1.0")).toBe(filled)

  const file = testInfo.outputPath(tableCellsExportName)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const saved = await partsOf(file)
  const original = await partsOf(join(fixtures, "table-added.pptx"))
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  const cells = cellProperties(saved.get(slidePart)?.toString("utf8") ?? "")
  expect(cells).toHaveLength(9)
  for (const cell of cells.slice(0, 3))
    expect(cell).toContain('<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>')
  for (const cell of cells.slice(3, 6)) {
    expect(cell).toMatch(/<\/a:lnB><a:solidFill><a:schemeClr val="accent2"\/><\/a:solidFill>$/)
    expect(cell).toContain('<a:lnB w="12700"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:lnB>')
  }
  for (const cell of cells.slice(6))
    expect(cell).toContain('<a:lnT w="12700"><a:solidFill><a:schemeClr val="accent1"/>')
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await expect.poll(() => cellFill(page, "0.0")).toBe(header)
  await expect.poll(() => cellFill(page, "1.1")).toBe(filled)
})
