import { expect } from "@playwright/test"
import { openDesign, openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await openDesign(page)
  await selectNode(page, "s:4")
  await expect(page.locator('[data-design-element] [data-design-section="Link"]')).toBeVisible()
}

export default { name: "text-link", design: "/screens/s43-08-editor-tools-text-format", drive }
