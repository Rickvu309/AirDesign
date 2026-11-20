import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const inside = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/nested-groups.pptx"))
  await page.locator(inside).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.press("Delete")
  await page.waitForTimeout(500)
}

export default { name: "group-deleted", design: editor, drive }
