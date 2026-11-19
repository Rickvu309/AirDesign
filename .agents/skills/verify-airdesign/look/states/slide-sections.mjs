import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"), 2)
  const add = kit.page.getByRole("button", { name: "Add slide" })
  await add.click()
  await add.click()
  await expect(kit.page.locator("[data-slide-item]")).toHaveCount(4)
  const numbers = kit.page.locator("[data-group-head]").last()
  await numbers.click()
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  const first = kit.page.locator('[data-slide-entry="1"]')
  await first.click()
  await expect(first).toHaveAttribute("aria-current", "true")
}

export default { name: "slide-sections", design: editor, drive }
