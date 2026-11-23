import { editor } from "../editor-screen.mjs"
import { committed, largeTextBox } from "../large-text.mjs"

async function drive(kit) {
  const { page } = kit
  const element = await largeTextBox(kit)
  const box = await element.boundingBox()
  if (box === null) throw new Error("no element box")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await committed(kit, async () => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 60, from.y + 30, { steps: 6 })
    await page.mouse.up()
  })
}

export default { name: "editor-large-text-moved", design: editor, drive }
