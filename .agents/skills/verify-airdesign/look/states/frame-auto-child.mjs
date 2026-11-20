import { expect } from "@playwright/test"
import { transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"
import { setPanelMode } from "../panel-mode.mjs"

const element = (shape) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${shape}"]`

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await page.locator(element(5)).click()
  await page.locator(element(5)).dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await page.mouse.move(4, 4)
}

export default { name: "frame-auto-child", design: editor, drive }
