import { expect } from "@playwright/test"
import { openDoomDeck, readDoom } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText, textEditor } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await placeText(page, 384, 760)
  await page.keyboard.type("Remove me")
  await leaveText(page)
  await page.keyboard.press("Escape")
  await placeText(page, 384, 880)
  await page.keyboard.type("Added text", { delay: 30 })
  await expect(textEditor(page)).toBeFocused()
  await leaveText(page)
  await expect.poll(async () => JSON.stringify((await readDoom(kit, opened)).fold.nodes)).toContain("Added text")
}

export default { name: "element-added", design: editor, drive }
