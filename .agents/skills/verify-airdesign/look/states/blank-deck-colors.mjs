import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: "Theme colors" })).toBeVisible()
}

export default { name: "blank-deck-colors", design: editor, drive }
