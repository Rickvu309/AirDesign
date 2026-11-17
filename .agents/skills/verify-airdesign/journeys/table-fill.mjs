import path from "node:path"
import { readFile } from "node:fs/promises"
import { tableCopy } from "../../../../apps/web/src/copy/table-copy.ts"

export default async function drive(kit) {
  const { page, expect, repo, capture, note, post, deckRoutes } = kit
  const { cookie } = await kit.signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/table-added.pptx")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await expect(page.getByRole("button", { name: tableCopy.tool, exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await table.click()
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator("[data-table-bar], [data-table-picker]")).toHaveCount(0)
  await capture("imported-table")
  const before = await post(deckRoutes.open, { deck }, cookie)
  const refused = await post(
    deckRoutes.commit,
    { deck, batch: [{ node: "256.4", value: '{"rows":[{"from":0,"cells":[[{"from":0,"runs":[]}]]}]}' }] },
    cookie,
  )
  expect(refused.json.ok).toBe(false)
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(table).toContainText("Region")
  const after = await post(deckRoutes.open, { deck }, cookie)
  expect(after.json.register).toEqual(before.json.register)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "table-preserved.pptx")
  await (await downloading).saveAs(exported)
  expect(await readFile(exported)).toEqual(await readFile(fixture))
  note(
    "Imported table preserved byte for byte after reload and export; new table edits refused and server register unchanged",
  )
}
