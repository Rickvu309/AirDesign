import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { contrast } from "../../packages/document/src/index.ts"
import { tableReadableExportName } from "../../scripts/pptx-cases/trait-table.mjs"
import { pickColor } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { newBlankDeck } from "./new-deck"
import { partsOf } from "./shape-fills"
import { insertTable } from "./insert-table"

const judged = join(process.cwd(), "tests/browser", tableReadableExportName)
const office = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

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

async function fillRow(page: Page, row: number, color: string): Promise<void> {
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("textbox", { name: `Row ${row}, column 1` }).focus()
  await panel.getByRole("group", { name: "Apply to", exact: true }).getByRole("button", { name: "Row" }).click()
  await panel.getByRole("group", { name: "Cell fill", exact: true }).getByRole("button", { name: "Color" }).click()
  await pickColor(page, panel.getByRole("group", { name: "Color", exact: true }).first(), color)
}

test("a new table has a theme header, and text stays readable on any fill a person picks, through undo, reload and export @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await insertTable(page, 4, 3)
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  const cell = (spot: string) => table.locator(`[data-table-text="${spot}"]`)
  await expect(cell("0.0")).toBeFocused()
  await page.keyboard.type("Region")
  await cell("1.0").click()
  await page.keyboard.type("North")
  await page.keyboard.press("Escape")
  const header = await readable(page, "0.0", "Region")
  expect(header.ink).toBe("FFFFFF")
  expect((await readable(page, "1.0", "North")).ink).toBe("202020")

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await fillRow(page, 1, "Accent 1")
  await expect(page.getByRole("button", { name: "Undo cell fill", exact: true })).toBeEnabled()
  expect(await readable(page, "0.0", "Region")).toEqual(header)
  await fillRow(page, 2, "Dark 2")
  await expect.poll(async () => (await shown(page, "1.0")).ground).toBe("1F3A5F")
  expect((await readable(page, "1.0", "North")).ink).toBe("FFFFFF")
  await fillRow(page, 1, "Light 2")
  await expect.poll(async () => (await shown(page, "0.0")).ground).toBe("EEF2F6")
  expect((await readable(page, "0.0", "Region")).ink).toBe("202020")

  await page.getByRole("button", { name: "Undo cell fill", exact: true }).click()
  await expect.poll(async () => (await shown(page, "0.0")).ground).toBe(header.ground)
  expect(await readable(page, "0.0", "Region")).toEqual(header)
  await page.reload()
  await settled(page)
  expect(await readable(page, "0.0", "Region")).toEqual(header)
  expect(await readable(page, "1.0", "North")).toEqual({ ink: "FFFFFF", ground: "1F3A5F" })

  const file = testInfo.outputPath(tableReadableExportName)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const saved = await partsOf(file)
  const xml = saved.get("ppt/slides/slide1.xml")?.toString("utf8") ?? ""
  expect(xml).toContain(`<a:tableStyleId>${office}</a:tableStyleId>`)
  expect(xml).toMatch(/<a:schemeClr val="lt1"\/><\/a:solidFill><\/a:rPr><a:t>North<\/a:t>/)
  expect(saved.get("ppt/tableStyles.xml")?.toString("utf8")).toContain(`styleId="${office}"`)
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  expect(await readable(page, "0.0", "Region")).toEqual(header)
  expect(await readable(page, "1.0", "North")).toEqual({ ink: "FFFFFF", ground: "1F3A5F" })
})
