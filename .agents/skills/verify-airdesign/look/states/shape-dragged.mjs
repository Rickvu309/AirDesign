import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const element = "ppt/slides/slide1.xml#2"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(kit.page.locator(`[data-slide-list] [data-thumb-element="${element}"]`)).toBeAttached()
  const slide = await kit.page.locator("[data-slide-paint]").boundingBox()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  const from = { x: slide.x + 300, y: slide.y + 120 }
  await kit.page.mouse.move(from.x, from.y)
  await kit.page.mouse.down()
  await kit.page.mouse.move(from.x + 240, from.y + 240, { steps: 8 })
  await kit.page.mouse.up()
  await expect(kit.page.getByRole("button", { name: "Undo move" })).toBeEnabled()
}

export default { name: "shape-dragged", design: editor, drive }
