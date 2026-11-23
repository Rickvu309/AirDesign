import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator('[data-slide-entry="2"]').focus()
  await kit.page.keyboard.press("Shift+Tab")
  await kit.page.keyboard.press("Tab")
  for (let press = 0; press < 12; press += 1) {
    await kit.page.keyboard.press("Tab")
    const name = await kit.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")
    if (name === "Text") return
  }
  throw new Error("the Text tool never took focus")
}

export default { name: "focus-toolbar", design: editor, drive }
