import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"

async function drive(kit) {
  await openAgent(kit)
  await kit.context.setOffline(true)
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect(kit.page.getByText("You're offline. Edits are saved on this device.", { exact: true })).toBeVisible()
}

export default { name: "editor-offline", design: "/screens/s49-02-editor-errors-offline", drive }
