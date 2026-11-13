import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  await expect(kit.page.locator("[data-editor-grid]")).toBeVisible()
  await expect(kit.page.getByRole("heading", { name: "Opening" })).toBeVisible()
  await expect(kit.page.getByRole("heading", { name: "Numbers" })).toBeVisible()
}

export default { name: "slide-grid", design, drive }
