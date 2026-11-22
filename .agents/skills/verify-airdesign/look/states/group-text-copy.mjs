import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { productCopy, readPictureToolCopy, transitionCopy } from "../../bin/product-copy.mjs"

const words = "Market context and sizing"
const label = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#7"]'

async function drive(kit) {
  const iconCopy = readPictureToolCopy()
  const { page } = kit
  await kit.signIn()
  await page.goto(".")
  await newBlankDeck(page)
  await expect(page.locator(".thin-page[data-deck-ready]")).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  await page.getByRole("button", { name: iconCopy.addIcon, exact: true }).click()
  await page.locator("[data-icon-tool]").getByRole("searchbox", { name: iconCopy.search }).fill("star")
  await page.locator("[data-icon-tool]").getByRole("button", { name: "star", exact: true }).click()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  await page.keyboard.press("t")
  await page.mouse.click(slide.x + slide.width * 0.56, slide.y + slide.height * 0.48)
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await page.keyboard.press("ControlOrMeta+KeyA")
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", "256.4")
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", "256.5")
  for (let step = 0; step < 20; step += 1) await page.keyboard.press("Shift+ArrowDown")
  await expect(page.locator(label)).toHaveCount(1)
}

export default { name: "group-text-copy", design: "/screens/s43-10-editor-tools-layers", drive }
