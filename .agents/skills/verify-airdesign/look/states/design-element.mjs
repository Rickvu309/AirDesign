import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await kit.page.keyboard.press("Escape")
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
}

export default { name: "design-element", design: "/screens/s43-09-editor-tools-design-element", drive }
