import { expect } from "@playwright/test"
import { node, openDoomDeck, savedNode, selectNode, spot } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { textLayer } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit, [
    textLayer("t:1", "Remove me", spot(384, 760, 700, 80)),
    textLayer("t:2", "Added text", spot(384, 880, 700, 80)),
  ])
  await selectNode(page, "t:1")
  await page.keyboard.press("Delete")
  await expect(node(page, "t:1")).toHaveCount(0)
  await expect.poll(async () => (await savedNode(kit, opened, "t:1"))?.parent ?? null).toBeNull()
}

export default { name: "element-deleted", design: editor, drive }
