import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"

async function drive(kit) {
  await openAgent(kit)
  const week = 7 * 24 * 60 * 60 * 1000
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) =>
      route.fulfill({
        status: 402,
        json: {
          ok: false,
          refusal: "allowance",
          usage: { used: 2, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() },
        },
      }),
  )
  const composer = kit.page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Make the title bigger")
  await composer.press("Enter")
  await expect(kit.page.getByText("You've hit this week's limit", { exact: true })).toBeVisible()
}

export default { name: "agent-out-of-usage", design: "/screens/s92-01-credits-out-of-usage-limit-reached", drive }
