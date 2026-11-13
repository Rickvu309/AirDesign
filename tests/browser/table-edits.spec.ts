import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { newBlankDeck } from "./new-deck"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function storedTable(page: Page, rows: number, text: string): Promise<void> {
  await page.waitForFunction(
    async ([count, wanted]) => {
      const values = await new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const all = request.result.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            request.result.close()
            resolve(all.result as unknown[])
          }
        }
      })
      return values.some((row) => {
        const value = typeof row === "object" && row !== null && "value" in row ? row.value : null
        if (typeof value !== "string" || !value.startsWith('{"rows"')) return false
        const table = JSON.parse(value) as { rows: unknown[] }
        return table.rows.length === count && value.includes(wanted)
      })
    },
    [rows, text] as const,
  )
}

test("inserts a table, types in two cells, adds and deletes a row, and it all survives a reload, the export and a new import", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  const rows = table.locator('[role="row"]')
  const cell = (spot: string) => table.locator(`[data-table-text="${spot}"]`)
  await expect(rows).toHaveCount(3)
  await expect(cell("0.0")).toBeFocused()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.type("Region")
  await page.keyboard.press("Tab")
  await expect(cell("0.1")).toBeFocused()
  await page.keyboard.type("Sales")
  await expect(cell("0.0")).toHaveText("Region")
  await storedTable(page, 3, "Sales")
  await expect(page.locator('[data-slide-entry="1"] [data-thumb-paint]')).toContainText("Sales")
  await expect(cell("0.1")).toBeFocused()
  await page.getByRole("button", { name: "Add row below row 1", exact: true }).click()
  await expect(rows).toHaveCount(4)
  await expect(page.getByRole("button", { name: "Undo add row", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Undo add row", exact: true }).click()
  await expect(rows).toHaveCount(3)
  await page.getByRole("button", { name: "Redo add row", exact: true }).click()
  await expect(rows).toHaveCount(4)
  await cell("3.2").click()
  await page.keyboard.press("Tab")
  await expect(rows).toHaveCount(5)
  await expect(cell("4.0")).toBeFocused()
  await page.getByRole("button", { name: "Delete row 5", exact: true }).click()
  await expect(rows).toHaveCount(4)
  await cell("1.0").click()
  await page.getByRole("button", { name: "Delete row 2", exact: true }).click()
  await expect(rows).toHaveCount(3)
  await storedTable(page, 3, "Region")
  await page.reload()
  await settled(page)
  await expect(rows).toHaveCount(3)
  await expect(table).toContainText("Region")
  await expect(table).toContainText("Sales")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("table-edits.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  expect(xml).toContain("<a:t>Region</a:t>")
  expect(xml).toContain("<a:t>Sales</a:t>")
  const heights = [...xml.matchAll(/<a:tr h="(\d+)">/g)].map((found) => Number(found[1]))
  expect(heights).toHaveLength(3)
  const frame = xml.match(/<p:graphicFrame>.*?<a:ext cx="\d+" cy="(\d+)"\/>/)?.[1]
  expect(Number(frame)).toBe(heights.reduce((sum, height) => sum + height, 0))
  expect(xml.match(/<a:tc>/g)).toHaveLength(9)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await expect(rows).toHaveCount(3)
  await expect(table).toContainText("Region")
  await expect(table).toContainText("Sales")
})

test("Escape leaves the cell for the table and Delete removes the whole table", async ({ page }) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.press("Backspace")
  await expect(table).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(table).toHaveCount(0)
  await page.reload()
  await settled(page)
  await expect(table).toHaveCount(0)
})

test("Undo takes back the insert of a table and Redo brings it back, through a reload", async ({ page }) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toHaveCount(1)
  await page.getByRole("button", { name: "Undo add table", exact: true }).click()
  await expect(table).toHaveCount(0)
  await page.getByRole("button", { name: "Redo add table", exact: true }).click()
  await expect(table).toHaveCount(1)
  await expect(table.locator('[role="row"]')).toHaveCount(3)
  await page.getByRole("button", { name: "Undo add table", exact: true }).click()
  await expect(table).toHaveCount(0)
  await page.reload()
  await settled(page)
  await expect(table).toHaveCount(0)
})

test("one Ctrl+Z straight after typing in a new table's cell takes back the typing and keeps the table", async ({
  page,
}) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await expect(page.getByRole("button", { name: "Undo add table", exact: true })).toBeEnabled()
  await page.keyboard.type("Region")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(table.locator('[role="row"]')).toHaveCount(3)
  await expect(table.locator('[data-table-text="0.0"]')).toHaveText("")
  await expect(page.getByRole("button", { name: "Redo text edit", exact: true })).toBeEnabled()
})

test("Ctrl+Z with the caret in a table cell paints the cell's text from before the edit", async ({ page }) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const cell = page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]')
  await expect(cell).toBeFocused()
  await page.keyboard.type("Region", { delay: 50 })
  await expect(page.getByRole("button", { name: "Undo text edit", exact: true })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByRole("button", { name: "Redo text edit", exact: true })).toBeEnabled()
  await expect(cell).toBeFocused()
  await expect(cell).toHaveText("")
})

test("adds and deletes columns with undo and redo, and they survive a reload, the export and a new import", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  const cell = (spot: string) => table.locator(`[data-table-text="${spot}"]`)
  const columns = table.locator('[data-table-text^="0."]')
  const button = (name: string) => page.getByRole("button", { name, exact: true })
  await expect(cell("0.0")).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Tab")
  await page.keyboard.type("Sales")
  await storedTable(page, 3, "Sales")
  await expect(page.getByRole("toolbar", { name: "Table columns" })).toBeVisible()
  await button("Add column right of column 2").click()
  await expect(columns).toHaveCount(4)
  await expect(cell("0.2")).toBeFocused()
  await button("Undo add column").click()
  await expect(columns).toHaveCount(3)
  await button("Redo add column").click()
  await expect(columns).toHaveCount(4)
  await cell("0.2").click()
  await page.keyboard.type("Growth")
  await storedTable(page, 3, "Growth")
  await cell("0.0").click()
  await button("Delete column 1").click()
  await expect(columns).toHaveCount(3)
  await expect(cell("0.0")).toBeFocused()
  await expect(cell("0.0")).toHaveText("Sales")
  await button("Undo delete column").click()
  await expect(columns).toHaveCount(4)
  await expect(cell("0.0")).toHaveText("Region")
  await button("Redo delete column").click()
  await expect(columns).toHaveCount(3)
  await page.reload()
  await settled(page)
  await expect(columns).toHaveCount(3)
  await expect(cell("0.0")).toHaveText("Sales")
  await expect(cell("0.1")).toHaveText("Growth")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("table-columns.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  const widths = [...xml.matchAll(/<a:gridCol w="(\d+)"\/>/g)].map((found) => Number(found[1]))
  expect(widths).toHaveLength(3)
  const frame = xml.match(/<p:graphicFrame>.*?<a:ext cx="(\d+)" cy="\d+"\/>/)?.[1]
  expect(Number(frame)).toBe(widths.reduce((sum, width) => sum + width, 0))
  expect(xml.match(/<a:tc>/g)).toHaveLength(9)
  expect(xml).toContain("<a:t>Growth</a:t>")
  expect(xml).not.toContain("<a:t>Region</a:t>")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await expect(columns).toHaveCount(3)
  await cell("0.2").click()
  await button("Delete column 3").click()
  await expect(columns).toHaveCount(2)
  await button("Delete column 2").click()
  await expect(columns).toHaveCount(1)
  await expect(button("Delete column 1")).toBeDisabled()
})
