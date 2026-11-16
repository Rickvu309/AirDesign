import { editor } from "../editor-screen.mjs"
import { committed, largeTextBox } from "../large-text.mjs"

async function drive(kit) {
  const { page } = kit
  const element = await largeTextBox(kit)
  await element.click({ position: { x: 10, y: 10 }, force: true })
  await page.keyboard.press("Escape")
  const band = await page.locator("[data-slide-paint] [data-selection] [data-grip='move']").first().boundingBox()
  if (band === null) throw new Error("no move band")
  const from = { x: band.x + band.width / 2, y: band.y + band.height / 2 }
  await committed(kit, async () => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 60, from.y + 30, { steps: 6 })
    await page.mouse.up()
  })
}

export default { name: "editor-large-text-moved", design: editor, drive }
