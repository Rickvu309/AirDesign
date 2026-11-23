import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { placeText, textEditor } from "../doom-text.mjs"

async function drive({ page, context, ...kit }) {
  await openDoomDeck({ page, context, ...kit })
  const device = await context.newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await placeText(page, 384, 860)
  const words = "Typed at once"
  await page.keyboard.type(words, { delay: 0 })
  await expect(textEditor(page)).toHaveText(words)
  await expect(textEditor(page)).toBeFocused()
  await device.send("Emulation.setCPUThrottlingRate", { rate: 1 })
}

export default { name: "text-typed-at-once", design: editor, drive }
