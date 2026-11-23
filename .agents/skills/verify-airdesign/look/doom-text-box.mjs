import { openDoomDeck, spot, words } from "./doom-deck.mjs"

export const textBox = "w:1"

export function openTextBoxDeck(kit, chars = "Quarterly review") {
  return openDoomDeck(kit, [
    { id: textBox, props: { name: "Words", box: spot(160, 640, 900, 140), text: words(chars) } },
  ])
}
