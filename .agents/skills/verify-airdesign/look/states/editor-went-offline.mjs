import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"

async function drive(kit) {
  await openAgent(kit)
  await kit.context.setOffline(true)
  await expect(kit.page.locator("[data-save-status]")).toHaveText("Offline, saved on this device")
}

export default { name: "editor-went-offline", design: "/screens/s49-02-editor-errors-offline", drive }
