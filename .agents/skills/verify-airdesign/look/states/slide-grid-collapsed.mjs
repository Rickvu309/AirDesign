import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-after.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  const numbers = kit.page.locator("[data-editor-grid] [data-section-head]").last()
  await numbers.click()
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
}

export default { name: "slide-grid-collapsed", design, drive }
