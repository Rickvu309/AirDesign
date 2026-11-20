import { expect } from "@playwright/test"
import { shortcutCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const title = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]'

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "clean.pptx")
  await page.locator(title).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.getByRole("button", { name: shortcutCopy.gestures.export, exact: true }).click()
  await page.getByRole("dialog", { name: shortcutCopy.gestures.export }).waitFor()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: shortcutCopy.gestures.export })).toHaveCount(0)
  await page.mouse.move(4, 4)
}

export default { name: "selection-after-export", design: editor, drive }
