import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  const actions = kit.page.getByRole("button", { name: "Blank deck actions" })
  if (await actions.count()) await actions.click()
  else await kit.page.getByRole("button", { name: /^Rename deck:/ }).click()
}

export default { name: "deck-title-menu", design: editor, drive }
