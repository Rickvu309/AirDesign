import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await kit.page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await kit.page.keyboard.press("ControlOrMeta+z")
  await expect(text).not.toHaveText("Mine")
}

export default { name: "text-undone-in-box", design: editor, drive }
