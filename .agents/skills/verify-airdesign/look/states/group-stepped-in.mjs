import { expect } from "@playwright/test"
import { transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const leaf = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "nested-groups.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator(leaf).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.2$/)
  await page.locator(leaf).dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.[34]$/)
  await page.mouse.move(4, 4)
}

export default { name: "group-stepped-in", design: editor, drive }
