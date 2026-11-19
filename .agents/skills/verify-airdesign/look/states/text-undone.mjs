import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.dblclick()
  await kit.page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await kit.page.keyboard.press("Escape")
  await expect(text).toHaveText("Mine")
  await kit.page.keyboard.press("ControlOrMeta+z")
  await expect(kit.page.getByRole("button", { name: "Redo text edit" })).toBeEnabled()
}

export default { name: "text-undone", design: editor, drive }
