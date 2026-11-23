import { expect } from "@playwright/test"
import { accent, node, openDoomDeck, selectNode, spot } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "t:1",
      props: { name: "Rectangle", box: spot(1100, 200, 320, 240), geometry: { kind: "rect" }, fills: accent },
    },
    {
      id: "t:2",
      props: { name: "Ellipse", box: spot(1460, 200, 240, 240), geometry: { kind: "ellipse" }, fills: accent },
    },
  ])
  await selectNode(page, "t:1")
  await selectNode(page, "t:2", { shift: true })
  await expect(page.locator("[data-selection-outline]")).toHaveCount(2)
  await page.keyboard.press("Delete")
  await expect(node(page, "t:1")).toHaveCount(0)
  await expect(node(page, "t:2")).toHaveCount(0)
}

export default { name: "elements-deleted", design: editor, drive }
