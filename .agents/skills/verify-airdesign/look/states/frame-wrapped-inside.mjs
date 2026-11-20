import { expect } from "@playwright/test"
import { groupCopy, shapeCopy, shortcutCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const element = (shape) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${shape}"]`

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "blank.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const shift = { modifiers: [shortcutCopy.chord.other.shift] }
  await page.locator(element(2)).click()
  await page.locator(element(3)).click(shift)
  await page.keyboard.press("Delete")
  await expect(page.locator(element(2))).toHaveCount(0)
  const slide = await page.locator("[data-slide-paint]").first().boundingBox()
  if (slide === null) throw new Error("no slide")
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
  for (const [at, [name, shape]] of [
    [shapeCopy.shapes.square, 4],
    [shapeCopy.shapes.circle, 5],
    [shapeCopy.shapes.triangle, 6],
  ].entries()) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(page.locator(element(shape))).toBeVisible()
    await drag(shape, slide.x + slide.width * (0.3 + at * 0.16), slide.y + slide.height * 0.45)
  }
  await page.locator(element(4)).click()
  await page.locator(element(5)).click(shift)
  await page.locator(element(6)).click(shift)
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  await page.locator(element(5)).dblclick()
  await page.locator(element(6)).click(shift)
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Shift+A")
  await page
    .locator('[data-slide-paint] [data-selection="256.9"]')
    .waitFor({ timeout: 4000 })
    .catch(() => undefined)
  await page.mouse.move(4, 4)
}

export default { name: "frame-wrapped-inside", design: editor, drive }
