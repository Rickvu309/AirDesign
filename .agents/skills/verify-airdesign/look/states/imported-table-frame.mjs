import path from "node:path"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"), 10)
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "imported-table-frame", design: null, drive }
