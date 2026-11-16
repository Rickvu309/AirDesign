import path from "node:path"
import { quantile } from "../bin/bench-verdict.mjs"
import { home, imported } from "./import.mjs"

const editable = '[data-slide-paint] [contenteditable="true"]:focus'
const letters = "airdesign"

export default {
  name: "type-41",
  async setup({ repo, page, signIn, expect }) {
    await signIn()
    await home(page)
    await imported(page, path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
    await page.locator("[data-slide-paint] [data-canvas-element]").first().dblclick()
    await expect(page.locator(editable)).toHaveCount(1)
    await page.keyboard.press("End")
  },
  async measure({ page }) {
    const typed = []
    for (const letter of letters) {
      await page.evaluate((editable) => {
        const node = document.querySelector(editable)
        const before = node.textContent.length
        window.benchAnswer = new Promise((resolve) => {
          let pressed
          addEventListener("keydown", (event) => (pressed = event.timeStamp), { capture: true, once: true })
          const watch = new MutationObserver(() => {
            if (pressed === undefined || node.textContent.length <= before) return
            watch.disconnect()
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - pressed)))
          })
          watch.observe(node, { subtree: true, childList: true, characterData: true })
        })
      }, editable)
      await page.keyboard.press(letter)
      typed.push(await page.evaluate(() => window.benchAnswer))
    }
    return quantile(
      typed.sort((left, right) => left - right),
      0.5,
    )
  },
}
