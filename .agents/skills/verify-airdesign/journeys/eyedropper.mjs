import path from "node:path"
import { expect } from "@playwright/test"
import { colorCopy, fillWords, formatCopy, shapeCopy, transitionCopy } from "../bin/product-copy.mjs"

const fixture = "scripts/pptx-fixtures/clean.pptx"
const redHex = "D93829"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  await page.addInitScript(() => {
    delete window.EyeDropper
  })
  const { cookie } = await signIn()
  await page.goto("")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = /\/deck\/([A-Za-z0-9_-]{1,64})$/.exec(page.url())?.[1]
  if (deck === undefined) throw new Error("missing deck id")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)

  const register = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const fillButton = (label = fillWords.color) =>
    page
      .locator("[data-design-element]")
      .getByRole("button", { name: new RegExp(`^${label} `) })
      .first()
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
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 })
    await page.mouse.up()
  }

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const textLayer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const swatch = await addShape(shapeCopy.shapes.square)
  await dragBy(swatch, -180, 90)
  await swatch.click()
  await fillButton().click()
  const menu = page.locator("[data-color-picker]")
  const hexField = menu.getByRole("textbox", { name: colorCopy.hex, exact: true })
  if ((await hexField.count()) === 0) await menu.getByRole("button", { name: colorCopy.add, exact: true }).click()
  await hexField.fill(redHex)
  await hexField.press("Enter")
  await page.keyboard.press("Escape")
  await expect(fillButton()).toContainText(redHex)

  const target = await addShape(shapeCopy.shapes.circle)
  await dragBy(target, 180, 90)
  await target.click()
  const swatchBox = await swatch.boundingBox()
  if (swatchBox === null) throw new Error("missing swatch")
  const sampleX = swatchBox.x + swatchBox.width / 2
  const sampleY = swatchBox.y + swatchBox.height / 2

  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.move(sampleX, sampleY)
  await expect(page.locator("[data-eyedropper-preview]")).toHaveText(colorCopy.hexName(redHex))
  await capture("eyedropper-preview")

  await page.keyboard.press("Escape")
  await expect(page.locator("[data-eyedropper-overlay]")).toHaveCount(0)
  await expect(fillButton()).not.toContainText(redHex)

  await page.keyboard.press("i")
  await page.mouse.move(sampleX, sampleY)
  await page.mouse.click(sampleX, sampleY)
  await expect(fillButton()).toContainText(redHex)
  await capture("shape-sampled")

  await textLayer.click()
  await page.keyboard.press("i")
  await page.mouse.move(sampleX, sampleY)
  await page.mouse.click(sampleX, sampleY)
  await expect(fillButton(formatCopy.color)).toContainText(redHex)
  await capture("text-sampled")

  await expect
    .poll(async () => {
      const elements = Object.values((await register()).elements ?? {})
      const json = JSON.stringify(elements)
      return json.split(redHex).length - 1
    })
    .toBeGreaterThanOrEqual(3)
  note(
    `Eyedropper previewed ${colorCopy.hexName(redHex)}, cancelled on Esc, sampled fill onto a shape and text color onto text, and saved to the server.`,
  )
}
