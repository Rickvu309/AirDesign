import path from "node:path"
import { home, imported, painted } from "./import.mjs"

export default {
  name: "open-50",
  async setup({ repo, page, signIn, expect }) {
    await signIn()
    await home(page)
    const deck = await imported(page, path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
    await page.locator('[data-slide-entry="1"]').click()
    for (let count = 42; count <= 50; count += 1) {
      await page.keyboard.press("Control+d")
      await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
    }
    return deck
  },
  async measure({ page, expect }, deck) {
    const started = Date.now()
    await page.goto(`/deck/${deck}`)
    await painted(page, deck)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(50)
    return Date.now() - started
  },
}
