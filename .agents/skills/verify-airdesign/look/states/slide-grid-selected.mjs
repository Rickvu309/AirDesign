import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-after.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  await kit.page.locator('[data-slide-entry="3"]').click({ modifiers: ["Shift"] })
  await expect(kit.page.locator("[data-grid-selected]")).toBeVisible()
}

export default { name: "slide-grid-selected", design, drive }
