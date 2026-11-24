import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entries, entry } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await addSlides(page, 2)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(entries(page)).toHaveCount(3)
}

export default { name: "slides-reloaded", design: editor, drive }
