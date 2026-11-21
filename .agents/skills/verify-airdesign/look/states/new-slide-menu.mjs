import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await expect(kit.page.getByRole("menuitem")).toHaveCount(7)
}

export default { name: "new-slide-menu", design: editor, drive }
