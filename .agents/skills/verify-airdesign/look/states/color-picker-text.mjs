import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await kit.page.keyboard.press("Escape")
  const panel = kit.page.locator("[data-design-element]")
  await panel.getByRole("group", { name: "Text color" }).getByRole("button").first().click()
  await expect(kit.page.locator("[data-color-picker] [data-contrast]")).toBeVisible()
}

export default { name: "color-picker-text", design: "/screens/s43-09-editor-tools-design-element", drive }
