import path from "node:path"
import { expect } from "@playwright/test"

async function askedBeforeOpen(kit) {
  const { page } = kit
  await kit.signIn()
  await page.route(
    (url) => url.pathname === kit.deckRoutes.open.path,
    () => new Promise(() => undefined),
  )
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/blank.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const week = 7 * 24 * 60 * 60 * 1000
  const usage = { used: 0.4, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() }
  const call = {
    type: "tool_use",
    id: "toolu_before_open",
    name: "airdesign_add_slide",
    input: { deck, base: 0, after: "256", layout: "256" },
  }
  const said = "I couldn't add the slide."
  const turns = [
    [
      { type: "tool", id: call.id, name: call.name },
      { type: "end", ok: true, stop: "tool_use", content: [call], usage },
    ],
    [
      { type: "text", text: said },
      { type: "end", ok: true, stop: "end_turn", content: [{ type: "text", text: said }], usage },
    ],
  ]
  await page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body: `${(turns.shift() ?? turns.at(-1) ?? []).map((line) => JSON.stringify(line)).join("\n")}\n`,
      }),
  )
  const composer = page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Add a slide")
  await composer.press("Enter")
  await expect(page.locator("[data-editor-panel] [data-step-mark]").first()).toBeVisible()
  await page.waitForTimeout(1500)
}

export const airaOpenStates = [
  {
    name: "aira-indexing",
    design: "/screens/s42-01-editor-agent-working",
    journey: "agent-after-open",
    at: "adding-while-indexing",
    aira: true,
  },
  {
    name: "aira-stopped-landed",
    design: "/screens/s42-02-editor-agent-run-complete",
    journey: "agent-after-open",
    at: "stopped-after-landing",
    aira: true,
  },
  { name: "aira-asked-before-open", design: "/screens/s42-01-editor-agent-working", drive: askedBeforeOpen },
]
