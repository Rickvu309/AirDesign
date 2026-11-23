import { expect } from "@playwright/test"
import { node, selectNode } from "../doom-deck.mjs"
import { openTextBoxDeck, textBox } from "../doom-text-box.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await openTextBoxDeck(kit)
  await selectNode(page, textBox)
  const before = await node(page, textBox).boundingBox()
  const grip = await page.locator('[data-grip="bottom-right"]').boundingBox()
  if (before === null || grip === null) throw new Error("no text box or grip")
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + grip.height / 2 + 30, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await node(page, textBox).boundingBox())?.width).toBeGreaterThan(before.width + 40)
}

export default { name: "editor-selected", design: editor, drive }
