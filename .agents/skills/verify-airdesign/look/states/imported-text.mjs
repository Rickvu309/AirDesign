import path from "node:path"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx"), 5)
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "imported-text", design: null, drive }
