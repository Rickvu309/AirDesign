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
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const right = await page.locator(`[data-slide-paint] [data-canvas-element="${part}#5"]`).boundingBox()
  if (slide === null || right === null) throw new Error("slide not painted")
  await page.mouse.move(slide.x - 24, slide.y + 18)
  await page.mouse.down()
  await page.mouse.move(right.x + right.width * 0.6, right.y + right.height * 0.6, { steps: 6 })
  const marquee = page.locator("[data-slide-paint] [data-slide-marquee]")
  if ((await marquee.count()) > 0) await expect(marquee).toBeVisible()
}

export default { name: "canvas-marquee", design: editor, drive }
