import { expect } from "@playwright/test"
import { openAgent } from "./agent-panel.mjs"
import { askedOnce } from "./asked-once.mjs"

export async function historyOpen(kit, ask) {
  await askedOnce(kit, ask)
  const panel = kit.page.locator("[data-editor-panel]")
  await panel.getByRole("button", { name: "New chat", exact: true }).click()
  await panel.locator("[data-aira-history]").click()
  await expect(kit.page.locator("[data-aira-chats]")).toBeVisible()
}

export async function historyEmptyByKeys(kit) {
  await openAgent(kit)
  await kit.page.keyboard.press("Tab")
  await kit.page.locator("[data-editor-panel] [data-aira-history]").focus()
  await kit.page.keyboard.press("Enter")
  const chats = kit.page.locator("[data-aira-chats]")
  await expect(chats).toBeVisible()
  await expect(chats).toBeFocused()
}
