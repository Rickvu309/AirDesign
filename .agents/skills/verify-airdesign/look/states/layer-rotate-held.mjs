import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const shape = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  const layer = page.locator(shape)
  await layer.click()
  const box = await layer.boundingBox()
  const grip = page.locator('[data-slide-paint] [data-selection] [data-grip="rotate-top-right"]')
  if (box !== null && (await grip.count()) > 0) {
    const corner = await grip.boundingBox()
    if (corner !== null) {
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
      await page.keyboard.down("Shift")
      await page.mouse.down()
      await page.mouse.move(center.x + 120, center.y + 20, { steps: 8 })
    }
  }
  await expect(page.locator("[data-slide-paint] [data-selection]")).toBeVisible()
}

export default { name: "layer-rotate-held", design: editor, drive }
