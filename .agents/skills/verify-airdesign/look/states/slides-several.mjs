import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entry } from "../doom-slides.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await addSlides(kit.page, 1)
  await expect(entry(kit.page, 2)).toHaveAttribute("aria-current", "true")
}

export default { name: "slides-several", design: editor, drive }
