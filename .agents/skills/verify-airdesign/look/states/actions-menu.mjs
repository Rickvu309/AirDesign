import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: "Actions", exact: true }).click()
  await expect(kit.page.getByRole("menuitem", { name: "Table", exact: true })).toBeVisible()
}

export default { name: "actions-menu", design: "/screens/s43-07-editor-tools-actions", drive }
