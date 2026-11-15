import { expect } from "@playwright/test"
import { openAgent } from "./agent-panel.mjs"

export const decks = "**/decks/**"

export function kept(page) {
  return page.getByText(/Edits are saved on this device\./)
}

export async function unreachedEdit(kit) {
  await openAgent(kit)
  await kit.page.route(decks, (route) => route.abort("connectionfailed"))
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect(kept(kit.page)).toBeVisible()
}
