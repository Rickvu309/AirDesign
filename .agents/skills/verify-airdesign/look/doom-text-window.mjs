import { expect } from "@playwright/test"
import { openDesign, openDoomDeck } from "./doom-deck.mjs"
import { editText, textBar } from "./doom-text.mjs"

export async function textBarAt(kit, window, { design = false } = {}) {
  await kit.page.setViewportSize(window)
  const opened = await openDoomDeck(kit)
  if (design) await openDesign(kit.page)
  await editText(kit.page, "s:4")
  await expect(textBar(kit.page)).toBeVisible()
  return opened
}
