import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const { geometryCopy } = createRequire(import.meta.url)("../../../../../apps/web/src/copy/geometry-copy.ts")

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "shapes-added.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
  await shape.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  const corners = panel.getByRole("textbox", { name: geometryCopy.corners, exact: true })
  await corners.fill("20")
  await corners.press("Enter")
  await expect(corners).toHaveValue("20")
  const box = await shape.boundingBox()
  await page.mouse.move(box.x + box.width, box.y + box.height)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + 60, box.y + box.height + 90, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await shape.boundingBox()).height).toBeGreaterThan(box.height + 80)
}

export default { name: "corners-resized", design: "/screens/s43-09-editor-tools-design-element", drive }
