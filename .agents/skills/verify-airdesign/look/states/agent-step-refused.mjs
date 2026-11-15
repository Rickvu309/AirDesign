import path from "node:path"
import { expect } from "@playwright/test"
import { said, scriptTurns } from "../aira-turns.mjs"
import { editor } from "../editor-screen.mjs"

const node = "256.2"

async function drive(kit) {
  const { page, post, deckRoutes, mcpRoutes } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const title = page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await expect(title).toHaveText("Hello")
  const base = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  const value = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Hello from Aira" }] }])
  const call = {
    type: "tool_use",
    id: "toolu_step_refused",
    name: "airdesign_edit_deck",
    input: { deck, base, changes: [{ node, readAt: 0, value }] },
  }
  const intro = "I will change the title on the first slide."
  await scriptTurns(kit, [
    [
      { type: "text", text: intro },
      { type: "tool", id: call.id, name: call.name },
      { type: "end", ok: true, stop: "tool_use", content: [{ type: "text", text: intro }, call] },
    ],
    said("The title now reads Hello from Aira."),
  ])
  let open = () => undefined
  const gate = new Promise((resolve) => {
    open = resolve
  })
  const calling = (url) => url.pathname === mcpRoutes.mcp.path
  await page.route(calling, async (route) => {
    await gate
    await route.fallback()
  })
  const side = page.locator("[data-editor-panel]")
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Change the title to Hello from Aira")
  await composer.press("Enter")
  await expect(side.locator('[data-tool-state="working"]')).toBeVisible()
  await title.click()
  await page.keyboard.type("X")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.revision).toBeGreaterThan(base)
  open()
  await expect(side.locator('[data-tool-state="refused"]')).toBeVisible()
  await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  await page.unroute(calling)
}

export default { name: "agent-step-refused", design: editor, drive }
