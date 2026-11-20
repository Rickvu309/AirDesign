import path from "node:path"
import { newBlankDeck } from "../bin/new-deck.mjs"

const deckOf = (url) => url.replace(/^.*\//, "")

const words = ["Region", "Revenue", "Growth", "Europe", "4.2", "12%", "Americas", "6.8", "9%", "Asia", "3.1", "21%"]

export default async function drive(kit) {
  const { page, expect, capture, note, post, deckRoutes, aira } = kit
  const { tableCopy } = await import("../../../../apps/web/src/copy/table-copy.ts")
  const { airaCopy } = await import("../../../../apps/web/src/copy/aira-copy.ts")
  const { shortcutCopy } = await import("../../../../apps/web/src/copy/shortcut-copy.ts")
  const exportWord = shortcutCopy.gestures.export
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = deckOf(page.url())
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const canvas = page.locator("[data-slide-paint]")
  await canvas.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Shift+T")
  const picker = page.locator("[data-table-picker]")
  await expect(picker).toBeVisible()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await expect(picker).toContainText(tableCopy.sizeOf(2, 2))
  await capture("picker-by-key")
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(1, 1), exact: true }).hover()
  await page.mouse.down()
  await page.getByRole("button", { name: tableCopy.sizeOf(4, 3), exact: true }).hover()
  await expect(picker).toContainText(tableCopy.sizeOf(4, 3))
  await capture("picker-dragged")
  await page.mouse.up()
  const tables = canvas.locator("[data-canvas-table]")
  const table = tables.first()
  await expect(table).toHaveAttribute("aria-rowcount", "4")
  await expect(table).toHaveAttribute("aria-colcount", "3")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  for (const [at, word] of words.entries()) {
    await page.keyboard.type(word)
    if (at < words.length - 1) await page.keyboard.press("Tab")
  }
  await capture("typed-across")
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  await expect.poll(async () => JSON.stringify((await saved()).register), { timeout: 30_000 }).toContain("21%")
  await capture("table-selected")

  const base = Number((await saved()).revision)
  const slide = (await saved()).register.index?.slides?.[0]?.id ?? "256"
  aira([{ name: "add-table.sse", fill: { deck, base: String(base), slide } }, { name: "tabled.sse" }])
  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Add a table of revenue and growth by region")
  await page.keyboard.press("Enter")
  await expect(tables).toHaveCount(2, { timeout: 30_000 })
  await expect(tables.nth(1)).toContainText("Revenue ($B)")
  const added = (await saved()).register.order.filter((command) => command.slide === "element-add")
  expect(added.map((command) => [command.element.kind, command.runId === undefined ? "person" : "agent"])).toEqual([
    ["table", "person"],
    ["table", "agent"],
  ])
  await capture("aira-table")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "table-insert.pptx")
  await (await downloading).saveAs(exported)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deckOf(page.url()))
  await expect(tables).toHaveCount(2)
  await expect(tables.first().locator('[data-table-cell="3.2"]')).toContainText("21%")
  await expect(tables.nth(1)).toContainText("Americas")
  await capture("reimported")
  note(
    `Shift+T opened the table picker and the arrows sized it; a drag from 1 × 1 to 4 rows by 3 columns inserted that table with the caret in its first cell. Twelve words typed with Tab filled it, Escape selected the table, and the server held every cell. Aira's recorded edit_deck add of kind table (one path with a person's insert) put a second table with its cells on the slide under its run. The export opened again with both tables and their text in the same cells (${exported}).`,
  )
}
