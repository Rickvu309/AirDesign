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
  await insert(shapeCopy.shapes.square, 4)
  await insert(shapeCopy.shapes.circle, 5)
  const square = await box(4)
  await drag(5, square.x + square.width + 140, square.y + square.height / 2)
  await page.locator(element(4)).click()
  await page.locator(element(5)).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  await page.keyboard.press("Escape")
  await insert(shapeCopy.shapes.triangle, 8)
  const [left, right] = [await box(4), await box(5)]
  await drag(8, (left.x + left.width + right.x) / 2, left.y + left.height / 2)
  await expect.poll(async () => (await box(5)).x).toBeGreaterThan(right.x + 20)
  await page.mouse.move(4, 4)
}

export default { name: "frame-joined", design: editor, drive }
