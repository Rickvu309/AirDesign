import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entries, titleSlides } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await addSlides(page, 2)
  await titleSlides(kit, opened, ["Hello", "Second", "Third"])
  await entries(page).first().click()
  const helloAt = async () => (await entries(page).allTextContents()).findIndex((each) => each.includes("Hello")) + 1
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(helloAt).toBe(2)
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(helloAt).toBe(3)
}

export default { name: "slide-moved-twice", design: editor, drive }
