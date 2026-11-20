import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const rectangle = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto(".")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await page.locator(rectangle).click({ position: { x: 70, y: 50 } })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  const from = { x: slide.x + 100, y: slide.y + 80 }
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down("AltLeft")
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + 150, { steps: 10 })
  await expect.poll(() => page.locator(rectangle).evaluate((frame) => frame.style.top)).toBe("180px")
}

export default { name: "layer-duplicate-held", design: editor, drive }
