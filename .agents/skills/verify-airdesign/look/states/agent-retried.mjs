import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"
import { said, scriptTurns } from "../aira-turns.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openAgent(kit)
  const reply = "Your title now leads with the Q3 number."
  await scriptTurns(kit, [[{ type: "end", ok: false }], said(reply)])
  const side = kit.page.locator("[data-editor-panel]")
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Make the title lead with the Q3 number")
  await composer.press("Enter")
  await side.getByRole("button", { name: "Try again" }).click()
  await expect(side.getByText(reply, { exact: true })).toBeVisible()
}

export default { name: "agent-retried", design: editor, drive }
