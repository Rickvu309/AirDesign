import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openAgent(kit)
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) => route.fulfill({ status: 403, json: { ok: false, refusal: "off" } }),
  )
  const composer = kit.page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Make the title bigger")
  await composer.press("Enter")
  await expect(kit.page.getByText("Aira is switched off right now", { exact: true })).toBeVisible()
}

export default { name: "agent-off", design: editor, drive }
