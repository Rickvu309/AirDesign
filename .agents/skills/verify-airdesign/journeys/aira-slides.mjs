import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes, aira }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/blank.pptx"))
  await expect(page).toHaveURL(/\/deck\//)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(2)
  const deck = page.url().split("/").at(-1)
  await expect
    .poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.register?.index?.total)
    .toBeGreaterThan(0)
  const base = Number((await post(deckRoutes.open, { deck }, cookie)).json.revision)
  await capture("before-add")
  aira([
    { name: "add-slide.sse", fill: { deck, base: String(base) } },
    { name: "title-slide.sse", fill: { deck, base: String(base + 1), node: "257.2" } },
    { name: "edited.sse" },
  ])
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a slide and title it Hello from Aira")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator('[data-slide-entry="2"]')).toContainText("Hello from Aira")
  await capture("added-and-titled")
  const saved = (await post(deckRoutes.open, { deck }, cookie)).json
  expect(saved.register.order.at(-1)).toMatchObject({ slide: "add", id: "257" })
  expect(saved.register.elements["257.2"].landed.at(-1).value).toContain("Hello from Aira")
  await page.locator('[data-slide-entry="2"]').click()
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText("Hello from Aira")
  await page.reload()
  await expect(page.locator('[data-slide-entry="2"]')).toContainText("Hello from Aira")
  await capture("reloaded")
  await page.locator("[data-editor-panel]").getByRole("button", { name: "Undo", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect
    .poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order.at(-1)?.slide)
    .toBe("remove")
  await capture("run-undone")
  note(
    "Aira's replayed transport called add_slide then edit_deck through MCP; the new slide and title painted live, the server agreed, and reload kept both. The panel's Undo took the added slide back on the canvas and on the server.",
  )
}
