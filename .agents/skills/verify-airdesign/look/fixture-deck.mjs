import path from "node:path"
import { openDeck } from "./open-deck.mjs"

export async function fixtureDeck(kit, fixture = "clean.pptx") {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures", fixture))
}
