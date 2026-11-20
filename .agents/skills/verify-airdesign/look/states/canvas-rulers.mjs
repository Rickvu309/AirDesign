import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/census-updating-spm.pptx"))
  await page.keyboard.press("Shift+R")
  await page.locator("[data-slide-paint]").getByText("Updating the SPM", { exact: false }).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
}

export default { name: "canvas-rulers", design: editor, drive }
