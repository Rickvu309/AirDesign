import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"
import { shapeCopy, shortcutCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const fixture = fileURLToPath(new URL("../../../../../scripts/pptx-fixtures/blank.pptx", import.meta.url))

export default {
  name: "ungrouped-copy-add",
  design: editor,
  async drive(kit) {
    const { page } = kit
    await kit.signIn()
    await page.goto("/")
    await openDeck(page, fixture)
    const canvas = page.locator("[data-slide-paint]")
    const layer = (part, shape) => canvas.locator(`[data-canvas-element="ppt/slides/${part}.xml#${String(shape)}"]`)
    for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle]) {
      await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
      await page.getByRole("button", { name, exact: true }).click()
      await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
    }
    await layer("slide1", 4).click()
    await layer("slide1", 5).click({ modifiers: [shortcutCopy.chord.other.shift] })
    await page.keyboard.press("ControlOrMeta+KeyG")
    await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", "256.6")
    await page.locator('[data-slide-entry="1"]').click()
    await page.keyboard.press("ControlOrMeta+KeyD")
    await expect(page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
    await layer("slide2", 4).click()
    await page.keyboard.press("ControlOrMeta+Shift+KeyG")
    await expect(layer("slide2", 6)).toHaveCount(0)
    const slide = await canvas.boundingBox()
    if (slide === null) throw new Error("no slide")
    await page.mouse.click(slide.x + slide.width - 12, slide.y + slide.height - 12)
    await page.keyboard.press("KeyR")
    await expect(canvas.locator("[data-selection]"))
      .toHaveAttribute("data-selection", "257.7", { timeout: 3000 })
      .catch(() => undefined)
  },
}
