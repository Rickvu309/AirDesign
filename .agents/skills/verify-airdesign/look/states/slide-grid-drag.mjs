import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/sections-after.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  const source = await kit.page.locator('[data-slide-entry="2"]').boundingBox()
  const target = await kit.page.locator('[data-slide-entry="3"]').boundingBox()
  await kit.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await kit.page.mouse.down()
  await kit.page.mouse.move(target.x + target.width * 0.8, target.y + target.height / 2, { steps: 8 })
  await expect(kit.page.locator("[data-drop-bar]")).toBeVisible()
}

export default { name: "slide-grid-drag", design, drive }
