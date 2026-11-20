import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]').click()
  await kit.page.keyboard.press("Enter")
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]:focus').waitFor()
  await kit.page.keyboard.press("ControlOrMeta+a")
  await kit.page.keyboard.press("Escape")
}

export default { name: "text-left-unhighlighted", design: editor, drive }
