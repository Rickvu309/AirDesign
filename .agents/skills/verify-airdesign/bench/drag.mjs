import path from "node:path"
import { quantile } from "../bin/bench-verdict.mjs"

export default {
  name: "drag",
  async setup({ repo, page, signIn, expect }) {
    await signIn()
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
    const text = page.locator('[contenteditable="true"]')
    await expect(text).toHaveText("Hello")
    const slide = await page.locator("[data-slide-paint]").boundingBox()
    await text.click()
    await expect(page.locator("[data-selection]")).toHaveCount(1)
    return { x: Math.round(slide.x) + 300, y: Math.round(slide.y) + 150 }
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
    await page.mouse.move(from.x + 300, from.y, { steps: 30 })
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
