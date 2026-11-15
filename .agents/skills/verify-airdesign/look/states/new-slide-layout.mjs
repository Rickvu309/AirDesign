import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  await kit.page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await kit.page.locator('[data-layout="ppt/slideLayouts/slideLayout2.xml"]').click()
  await expect(kit.page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
  await expect(kit.page.locator("[data-slide-paint] [data-placeholder-prompt]").first()).toBeVisible()
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "new-slide-layout", design: editor, drive }
