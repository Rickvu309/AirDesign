import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openAgent(kit)
  await kit.page.locator("[data-editor-panel]").getByRole("button", { name: "Weekly usage" }).click()
  await expect(kit.page.getByRole("dialog", { name: "Weekly usage" })).toContainText("%")
}

export default { name: "usage-open", design: editor, drive }
