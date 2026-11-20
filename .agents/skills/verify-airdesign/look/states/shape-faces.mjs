import { shapeFacesDeck } from "../../../../../scripts/pptx-fixtures/shape-faces-deck.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, {
    name: "Shape faces.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: shapeFacesDeck(),
  })
}

export default { name: "shape-faces", design: null, drive }
