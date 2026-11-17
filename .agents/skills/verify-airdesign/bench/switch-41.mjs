import path from "node:path"
import { quantile } from "../bin/bench-verdict.mjs"
import { home, imported } from "./import.mjs"

const slides = [2, 3, 4, 5, 6, 7, 8, 9]

export default {
  name: "switch-41",
  async setup({ repo, page, signIn }) {
    await signIn()
    await home(page)
    await imported(page, path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  },
  async measure({ page }) {
    const switched = []
    for (const slide of slides) {
      await page.evaluate(() => {
        const keys = () =>
          [...document.querySelectorAll("[data-slide-paint] [data-canvas-element]")]
            .map((element) => element.getAttribute("data-canvas-element"))
            .join(" ")
        const before = keys()
        window.benchAnswer = new Promise((resolve) => {
          let pressed
          addEventListener("pointerdown", (event) => (pressed = event.timeStamp), { capture: true, once: true })
          const watch = new MutationObserver(() => {
            if (pressed === undefined || keys() === before) return
            watch.disconnect()
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - pressed)))
          })
          watch.observe(document.body, { subtree: true, childList: true, attributes: true })
        })
      })
      await page.locator(`[data-slide-entry="${slide}"]`).click()
      switched.push(await page.evaluate(() => window.benchAnswer))
    }
    return quantile(
      switched.sort((left, right) => left - right),
      0.5,
    )
  },
}
