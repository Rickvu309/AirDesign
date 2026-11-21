import { expect } from "@playwright/test"
import { openGroupDeck } from "../grid-group-add.mjs"

async function drive(kit) {
  await openGroupDeck(kit, 4, false)
  const entries = kit.page.locator("[data-slide-entry]")
  await expect(entries).toHaveCount(4)
  await kit.page.locator('[data-slide-entry="4"]').focus()
  await kit.page.keyboard.press("Home")
  await expect(kit.page.locator('[data-slide-entry="1"]')).toBeFocused()
  await kit.page.keyboard.press("Delete")
  await kit.page.keyboard.press("Delete")
  await expect(entries).toHaveCount(2)
}

export default { name: "slide-grid-deleted", design: "/screens/s41-01-editor-grid-default", drive }
