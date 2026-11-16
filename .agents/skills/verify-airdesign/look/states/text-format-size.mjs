import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await text.pressSequentially("Hello world")
  await kit.page.getByRole("button", { name: "Larger" }).click()
  await expect(kit.page.getByRole("textbox", { name: "Font size" })).toHaveValue("36")
}

export default { name: "text-format-size", design: "/screens/s43-08-editor-tools-text-format", drive }
