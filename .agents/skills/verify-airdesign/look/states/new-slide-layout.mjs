import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlideStart } from "../doom-slides.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await addSlideStart(kit.page, "Title and text")
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "new-slide-layout", design: editor, drive }
