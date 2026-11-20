import { expect } from "@playwright/test"
import { groupCopy, shapeCopy, shortcutCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const element = (shape) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${shape}"]`

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "blank.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const insert = async (name, shape) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(page.locator(element(shape))).toBeVisible()
  }
  const box = async (shape) => {
    const found = await page.locator(element(shape)).boundingBox()
    if (found === null) throw new Error(`no shape ${shape}`)
    return found
  }
  const drag = async (shape, x, y) => {
    const from = await box(shape)
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, y, { steps: 10 })
    await page.mouse.up()
  }
  const shift = { modifiers: [shortcutCopy.chord.other.shift] }
  await page.locator(element(2)).click()
  await page.locator(element(3)).click(shift)
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Delete")
  await expect(page.locator(element(2))).toHaveCount(0)
  const slide = await page.locator("[data-slide-paint]").first().boundingBox()
  if (slide === null) throw new Error("no slide")
  await insert(shapeCopy.shapes.square, 4)
  await drag(4, slide.x + slide.width * 0.4, slide.y + slide.height * 0.25)
  await insert(shapeCopy.shapes.circle, 5)
  const square = await box(4)
  await drag(5, square.x + square.width + 90, square.y + square.height / 2)
  await page.locator(element(4)).click()
  await page.locator(element(5)).click(shift)
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  await page.keyboard.press("Escape")
  await insert(shapeCopy.shapes.triangle, 8)
  const row = await box(4)
  await drag(8, row.x + row.width / 2, row.y + row.height + 90)
  await page.locator(element(4)).click()
  await page.locator(element(8)).click(shift)
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Shift+A")
  await page
    .locator('[data-slide-paint] [data-selection="256.9"]')
    .waitFor({ timeout: 4000 })
    .catch(() => undefined)
  await page.mouse.move(4, 4)
}

export default { name: "frame-nested", design: editor, drive }
