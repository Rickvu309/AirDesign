import { expect } from "@playwright/test"
import { fixtureDeck } from "./fixture-deck.mjs"

export async function designElementAt(kit, window) {
  await kit.page.setViewportSize(window)
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await kit.page.keyboard.press("Escape")
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
}

export async function textToolbarAt(kit, window) {
  await designElementAt(kit, window)
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await expect(kit.page.locator("[data-editor-toolbar] [data-text-format]")).toBeVisible()
}
