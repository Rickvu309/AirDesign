import { quantile } from "../bin/bench-verdict.mjs"
import { transitionCopy } from "../bin/product-copy.mjs"
import { chooseCards, leadCentre, openBusyDeck } from "../look/busy-drag.mjs"

export default {
  name: "drag-busy",
  async setup(kit) {
    const { page } = kit
    await kit.signIn()
    await openBusyDeck(kit)
    await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
    await chooseCards(page)
    return leadCentre(page)
  },
  async measure({ page }, from) {
    await page.mouse.move(from.x, from.y)
    await page.evaluate(() => {
      window.benchFrames = []
      let last
      const tick = (at) => {
        if (last !== undefined) window.benchFrames.push(at - last)
        last = at
        if (!window.benchStop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.mouse.down()
    await page.mouse.move(from.x + 240, from.y + 90, { steps: 30 })
    await page.mouse.up()
    const frames = await page.evaluate(() => {
      window.benchStop = true
      return window.benchFrames
    })
    return quantile(
      frames.sort((left, right) => left - right),
      0.95,
    )
  },
}
