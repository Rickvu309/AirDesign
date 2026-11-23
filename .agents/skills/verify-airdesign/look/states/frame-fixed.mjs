import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { autoRow, drag, grip } from "../doom-canvas.mjs"
import { openDesign, openDoomDeck, savedNode, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit, autoRow())
  await openDesign(page)
  await selectNode(page, "f:1", { position: { x: 12, y: 12 } })
  const from = await grip(page, "right")
  await drag(page, from, { x: from.x + 60, y: from.y }, 12)
  await expect.poll(async () => (await savedNode(kit, opened, "f:1"))?.sizing?.w).toBe("fixed")
  await page.mouse.move(4, 4)
}

export default { name: "frame-fixed", design: editor, drive }
