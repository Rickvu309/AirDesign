import { expect } from "@playwright/test"
import { openAgent } from "./agent-panel.mjs"

export async function askedOnce(kit, ask = "Make the Q3 investor update lead with the number. Keep it calm.") {
  await openAgent(kit)
  const week = 7 * 24 * 60 * 60 * 1000
  const usage = { used: 0.76, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() }
  const text = "Your title now leads with the Q3 number."
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body: `${JSON.stringify({ type: "text", text })}\n${JSON.stringify({ type: "end", ok: true, stop: "end_turn", content: [{ type: "text", text }], usage })}\n`,
      }),
  )
  const composer = kit.page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill(ask)
  await composer.press("Enter")
  await expect(kit.page.getByText(text, { exact: true })).toBeVisible()
}
