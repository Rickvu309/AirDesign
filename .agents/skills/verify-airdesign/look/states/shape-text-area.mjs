import { shapeTextDeck } from "../../../../../scripts/pptx-fixtures/shape-text-deck.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, {
    name: "Shape text.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: shapeTextDeck(),
  })
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "shape-text-area", design: null, drive }
