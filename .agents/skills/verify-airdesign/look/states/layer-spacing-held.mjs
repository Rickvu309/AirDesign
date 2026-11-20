import { shapeCopy } from "../../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const added = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#7"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(page.locator(added)).toBeVisible()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const box = await page.locator(added).boundingBox()
  const middle = (left, top) => ({ x: slide.x + left + box.width / 2, y: slide.y + top + box.height / 2 })
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(middle(600, 100).x, middle(600, 100).y, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up("Control")
  await expect(page.locator(added)).toHaveCSS("left", "600px")
  await page.mouse.move(middle(600, 100).x, middle(600, 100).y)
  await page.mouse.down()
  await page.mouse.move(middle(483, 100).x, middle(483, 100).y, { steps: 10 })
}

export default { name: "layer-spacing-held", design: editor, drive }
