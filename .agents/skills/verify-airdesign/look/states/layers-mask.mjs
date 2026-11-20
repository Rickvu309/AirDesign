import { shapeCopy, shortcutCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const picture = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "picture-png.pptx")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.circle, exact: true }).click()
  const added = page.locator("[data-slide-paint] [data-selection]")
  await added.waitFor()
  const from = await added.boundingBox()
  const to = await page.locator(picture).boundingBox()
  if (from === null || to === null) throw new Error("no box")
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2 + 40, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.press("BracketLeft")
  await page.locator(picture).click({ modifiers: [shortcutCopy.chord.other.shift], position: { x: 8, y: 8 } })
  await page.locator("[data-slide-paint] [data-chosen]").nth(1).waitFor()
  await page.keyboard.press("Control+Alt+KeyM")
  await page.locator("[data-slide-paint] [data-mask-clip]").waitFor()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await layers.locator("[data-layer-caret]").first().click()
  await layers.locator("[data-layer-masked]").waitFor()
  await page.mouse.move(4, 4)
}

export default { name: "layers-mask", design: "/screens/s43-10-editor-tools-layers", drive }
