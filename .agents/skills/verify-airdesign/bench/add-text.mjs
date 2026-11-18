import { newBlankDeck } from "../bin/new-deck.mjs"

const editable = '[data-slide-paint] [contenteditable="true"]'
const letter = "Q"

export default {
  name: "add-text",
  async setup({ page, signIn, expect }) {
    await signIn()
    await page.goto("/")
    await newBlankDeck(page)
    await expect(page.locator(editable)).toHaveCount(0)
  },
  async measure({ page }) {
    await page.evaluate(
      ({ editable, letter }) => {
        const before = new Set(document.querySelectorAll(editable))
        window.benchAnswer = new Promise((resolve) => {
          let clicked
          addEventListener("click", (event) => (clicked = event.timeStamp), { capture: true, once: true })
          const watch = new MutationObserver(() => {
            const typed = [...document.querySelectorAll(editable)].some(
              (node) => !before.has(node) && node.textContent.includes(letter),
            )
            if (clicked === undefined || !typed) return
            watch.disconnect()
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - clicked)))
          })
          watch.observe(document.body, { subtree: true, childList: true, characterData: true })
        })
      },
      { editable, letter },
    )
    await page.getByRole("button", { name: "Add text", exact: true }).click()
    await page.keyboard.type(letter, { delay: 0 })
    return page.evaluate(() => window.benchAnswer)
  },
}
