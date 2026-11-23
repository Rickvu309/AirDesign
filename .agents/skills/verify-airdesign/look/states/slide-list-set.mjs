import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDesign, openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entry, titleSlides } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await addSlides(page, 4)
  await titleSlides(
    kit,
    opened,
    [1, 2, 3, 4, 5].map((number) => `Chapter ${String(number)} of the story`),
  )
  await openDesign(page)
  await entry(page, 2).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await entry(page, 4).click({ modifiers: ["Shift"] })
  for (const number of [2, 3, 4]) await expect(entry(page, number)).toHaveAttribute("data-selected", "true")
}

export default { name: "slide-list-set", design: editor, drive }
