import { expect } from "@playwright/test"
import { colorCopy, fillWords, shapeCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const redHex = "D93829"

async function drive(kit) {
  const { page } = kit
  await page.addInitScript(() => {
    delete window.EyeDropper
  })
  await fixtureDeck(kit, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const addShape = async (name) => {
    const before = await layers.count()
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(layers).toHaveCount(before + 1)
    const key = await layers.last().getAttribute("data-canvas-element")
    if (key === null) throw new Error("missing key")
    return page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`)
  }
  const dragBy = async (layer, dx, dy) => {
    const box = await layer.boundingBox()
    if (box === null) throw new Error("missing shape")
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 4 })
    await page.mouse.up()
  }
  const swatch = await addShape(shapeCopy.shapes.square)
  await dragBy(swatch, -180, 90)
  await swatch.click()
  const fillButton = page
    .locator("[data-design-element]")
    .getByRole("button", { name: new RegExp(`^${fillWords.color} `) })
    .first()
  await fillButton.click()
  const menu = page.locator("[data-color-picker]")
  const hexField = menu.getByRole("textbox", { name: colorCopy.hex, exact: true })
  if ((await hexField.count()) === 0) await menu.getByRole("button", { name: colorCopy.add, exact: true }).click()
  await hexField.fill(redHex)
  await hexField.press("Enter")
  await page.keyboard.press("Escape")

  const target = await addShape(shapeCopy.shapes.circle)
  await dragBy(target, 180, 90)
  await target.click()
  const box = await swatch.boundingBox()
  if (box === null) throw new Error("missing swatch")
  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator("[data-eyedropper-preview]")).toHaveText(colorCopy.hexName(redHex))
}

export default { name: "eyedropper-active", design: "/screens/s43-09-editor-tools-design-element", drive }
