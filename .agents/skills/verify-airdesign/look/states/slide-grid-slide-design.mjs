import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s43-02-editor-tools-design-panel"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  await kit.page.locator("[data-editor-grid] [data-grid-card]").nth(1).locator("[data-slide-number]").click()
  await expect(kit.page.locator('[data-editor-grid] [data-slide-entry="2"]')).toHaveAttribute("data-selected", "")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-editor-panel]").getByText("Slide 2", { exact: true })).toBeVisible()
}

export default { name: "slide-grid-slide-design", design, drive }
