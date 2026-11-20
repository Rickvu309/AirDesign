import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../apps/web/src/copy/table-copy.ts")
const { shortcutCopy } = require("../../../../apps/web/src/copy/shortcut-copy.ts")
const { undoCopy } = require("../../../../apps/web/src/copy/undo-copy.ts")

const deckOf = (url) => url.replace(/^.*\//, "")

export default async function drive(kit) {
  const { page, expect, repo, capture, note, post, deckRoutes } = kit
  const exportWord = shortcutCopy.gestures.export
  const { cookie } = await kit.signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/table-added.pptx")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = deckOf(page.url())
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  const columns = Number(await table.getAttribute("aria-colcount"))
  const rows = Number(await table.getAttribute("aria-rowcount"))
  await table.click()
  await capture("selected")
  await page.getByRole("button", { name: tableCopy.addColumn, exact: true }).hover()
  await capture("add-column-bar-hovered")
  await page.getByRole("button", { name: tableCopy.addColumn, exact: true }).click()
  await expect(table).toHaveAttribute("aria-colcount", String(columns + 1))
  await page.getByRole("button", { name: tableCopy.insertRow(1), exact: true }).click()
  await expect(table).toHaveAttribute("aria-rowcount", String(rows + 1))
  await capture("column-and-row-added")
  const row = page.getByRole("button", { name: tableCopy.row(2), exact: true })
  await row.click()
  await capture("row-picked")
  await row.press("Delete")
  await expect(table).toHaveAttribute("aria-rowcount", String(rows))
  const border = table.locator('[data-column-border="0"]').first()
  const spot = await border.boundingBox()
  if (spot === null) throw new Error("no border")
  await page.mouse.move(spot.x + spot.width / 2, spot.y + 4)
  await page.mouse.down()
  await page.mouse.move(spot.x + spot.width / 2 + 60, spot.y + 4, { steps: 6 })
  await capture("column-dragging")
  await page.mouse.up()
  const widths = async () => {
    const body = (await post(deckRoutes.open, { deck }, cookie)).json.register.elements["256.4"]
    const shown = body?.landed.filter((row) => row.visible).at(-1)?.value
    return shown === undefined ? null : (JSON.parse(shown).widths ?? null)
  }
  await expect.poll(widths, { timeout: 30_000 }).not.toBeNull()
  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(widths, { timeout: 30_000 }).toBeNull()
  await page.getByRole("button", { name: undoCopy.redoNamed.resize, exact: true }).click()
  await expect.poll(widths, { timeout: 30_000 }).not.toBeNull()
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(table).toHaveAttribute("aria-colcount", String(columns + 1))
  await capture("reloaded")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "table-rows-columns.pptx")
  await (await downloading).saveAs(exported)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deckOf(page.url()))
  await expect(table).toHaveAttribute("aria-colcount", String(columns + 1))
  await capture("reimported")
  note(
    `The imported table took a column from the right-edge bar and a row from the plus below row 1; its Row 2 handle picked the row and Delete removed only it. A drag on the first column border moved width to that column, and Undo resize and Redo resize took the widths out of the server copy and back. After a reload and an export, the file opened again with ${String(columns + 1)} columns (${exported}).`,
  )
}
