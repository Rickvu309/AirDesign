import { expect } from "@playwright/test"
import { accent, openDesign, openDoomDeck, selectNode, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    { id: "w:1", props: { name: "Card", box: spot(1100, 300, 520, 320), geometry: { kind: "rect" }, fills: accent } },
  ])
  await openDesign(page)
  await selectNode(page, "w:1")
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
}

export default { name: "design-shape", design: "/screens/s43-09-editor-tools-design-element", drive }
