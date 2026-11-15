import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openAgent(kit)
  await kit.page.route("**/decks/commit", () => undefined)
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect(kit.page.locator("[data-save-status]")).toHaveText("Saving…")
}

export default { name: "editor-saving", design: editor, drive }
