import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await kit.page.getByRole("button", { name: "Text color" }).click()
  await expect(
    kit.page.locator("[data-color-picker]").getByRole("button", { name: "Accent 1", exact: true }),
  ).toBeVisible()
}

export default { name: "text-format-color", design: "/screens/s43-08-editor-tools-text-format", drive }
