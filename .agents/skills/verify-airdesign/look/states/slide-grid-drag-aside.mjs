import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const design = "/screens/s41-01-editor-grid-default"

async function drive(kit) {
  await kit.signIn()
  await kit.page.emulateMedia({ reducedMotion: "no-preference" })
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  await kit.page.getByRole("button", { name: "Grid" }).click()
  await kit.page.waitForFunction(() => document.getAnimations().every((each) => each.playState !== "running"))
  const source = await kit.page.locator('[data-slide-entry="3"]').boundingBox()
  const target = await kit.page.locator('[data-slide-entry="5"]').boundingBox()
  await kit.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await kit.page.mouse.down()
  await kit.page.mouse.move(target.x + target.width * 0.8, target.y + target.height / 2, { steps: 8 })
  await expect(kit.page.locator('[data-slide-entry="5"]').locator("..")).not.toHaveCSS("transform", "none")
  await kit.page.emulateMedia({ reducedMotion: "reduce" })
  await kit.page.mouse.move(target.x + target.width * 0.82, target.y + target.height / 2)
  await kit.page.waitForFunction(() => document.getAnimations().every((each) => each.playState !== "running"))
  await expect(kit.page.locator('[data-slide-entry="5"]').locator("..")).not.toHaveCSS("transform", "none")
  await expect(kit.page.locator("[data-drop-bar]")).toBeHidden()
}

export default { name: "slide-grid-drag-aside", design, drive }
