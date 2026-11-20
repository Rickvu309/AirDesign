import { shapeCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

const painted = (shape) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${String(shape)}"]`

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "blank.pptx")
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle]) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  await page.locator(painted(5)).waitFor()
  await page.locator(painted(4)).click()
  await page.keyboard.down("ShiftLeft")
  await page.locator(painted(5)).click()
  await page.keyboard.up("ShiftLeft")
  await page.keyboard.press("ControlOrMeta+KeyG")
  await page.locator(painted(6)).waitFor()
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  const from = await page.locator(painted(4)).boundingBox()
  if (from === null) throw new Error("no square")
  await page.locator(painted(4)).click({ modifiers: ["ControlOrMeta"] })
  const [x, y] = [from.x + from.width / 2, from.y + from.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 160, y - 110, { steps: 8 })
  await page.mouse.up()
}

export default { name: "frame-group-layer-moved", design: editor, drive }
