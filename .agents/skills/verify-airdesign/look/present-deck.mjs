import path from "node:path"
import { openDeck } from "./open-deck.mjs"

export async function presentState(kit, view = "audience") {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"), 2)
  await kit.page.getByRole("button", { name: "Present", exact: true }).click()
  await kit.page.locator("[data-present-show] [data-thumb-paint]").waitFor()
  if (view === "presenter") {
    await kit.page.keyboard.press("p")
    await kit.page.locator("[data-presenter-view] [data-thumb-paint]").first().waitFor()
  }
}
