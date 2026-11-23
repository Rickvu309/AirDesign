import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { committed, largeTextBox } from "../large-text.mjs"

async function drive(kit) {
  const { page } = kit
  const element = await largeTextBox(kit)
  const box = await element.boundingBox()
  if (box === null) throw new Error("no element box")
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
  const editing = page.locator('[contenteditable="true"]')
  await expect(editing).toBeFocused()
  await committed(kit, async () => {
    await page.keyboard.press("ControlOrMeta+End")
    await page.keyboard.press("!")
    await page.keyboard.press("Escape")
  })
}

export default { name: "editor-large-text-typed", design: editor, drive }
