import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "blank.pptx")
  const paint = page.locator("[data-slide-paint]")
  await paint.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("r")
  const slide = await paint.boundingBox()
  if (slide === null) throw new Error("no slide")
  const points = slide.width / 960
  await page.mouse.move(slide.x + 80 * points, slide.y + 120 * points)
  await page.mouse.down()
  await page.mouse.move(slide.x + 380 * points, slide.y + 270 * points, { steps: 12 })
}

export default { name: "shape-drawing", design: editor, drive }
