import { expect } from "@playwright/test"
import { node } from "../doom-deck.mjs"
import { openTextBoxDeck, textBox } from "../doom-text-box.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await openTextBoxDeck(kit)
  const box = await node(page, textBox).boundingBox()
  if (box === null) throw new Error("no text box")
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('[contenteditable="true"]')).toBeFocused()
}

export default { name: "editor-text-focused", design: editor, drive }
