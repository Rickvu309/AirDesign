import path from "node:path"
import { openDeck } from "./open-deck.mjs"

export async function notesState(kit, open = false) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  await kit.page.getByRole("button", { name: "Collapse presenter notes" }).click()
  if (open) await kit.page.getByRole("button", { name: "Expand presenter notes" }).click()
}
