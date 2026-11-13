import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  const bullets = kit.page.getByRole("button", { name: "Bullets" })
  await bullets.click()
  await expect(bullets).toHaveAttribute("aria-pressed", "true")
}

export default { name: "text-format-bullets", design: "/screens/s43-08-editor-tools-text-format", drive }
