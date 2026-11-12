import { expect } from "@playwright/test"
import { askedOnce } from "./asked-once.mjs"

export async function historyOpen(kit, ask) {
  await askedOnce(kit, ask)
  const panel = kit.page.locator("[data-editor-panel]")
  await panel.getByRole("button", { name: "New chat", exact: true }).click()
  await panel.locator("[data-aira-history]").click()
  await expect(kit.page.locator("[data-aira-chats]")).toBeVisible()
}
