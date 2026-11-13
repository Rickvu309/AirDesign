import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-02-editor-grid-add-slide-hover"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  const plus = kit.page.locator('[aria-label="Add slide after slide 1"]')
  await kit.page.locator('[data-slide-entry="1"]').hover()
  await expect(plus).toBeVisible()
}

export default { name: "slide-grid-add", design, drive }
