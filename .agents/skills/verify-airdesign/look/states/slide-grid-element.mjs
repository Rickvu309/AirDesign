import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  const second = kit.page.locator("[data-editor-grid] [data-grid-card]").nth(1)
  await second.locator("[data-thumb-node]").first().click({ force: true })
  await expect(second.locator("[data-grid-edit] [data-selection]")).toHaveCount(1)
}

export default { name: "slide-grid-element", design, drive }
