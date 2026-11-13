import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  const center = kit.page.getByRole("radio", { name: "Align center" })
  await center.click()
  await expect(center).toHaveAttribute("aria-checked", "true")
}

export default { name: "text-format-align", design: "/screens/s43-08-editor-tools-text-format", drive }
