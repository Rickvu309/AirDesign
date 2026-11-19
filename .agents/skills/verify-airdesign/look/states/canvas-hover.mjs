import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const part = "ppt/slides/slide1.xml"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  const shape = page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`)
  const box = await shape.boundingBox()
  if (box === null) throw new Error("shape not painted")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const outline = page.locator("[data-slide-paint] [data-hover-outline]")
  if ((await outline.count()) > 0) await expect(outline).toBeVisible()
}

export default { name: "canvas-hover", design: editor, drive }
