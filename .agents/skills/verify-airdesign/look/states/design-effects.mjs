import { expect } from "@playwright/test"
import { openDesign, openDoomDeck } from "../doom-deck.mjs"
import { element, seeds, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const card = { ...seeds.shape, props: { ...seeds.shape.props, effects: "glow" } }
  await openDoomDeck(kit, [card])
  await openDesign(kit.page)
  await selectMany(kit.page, [card.id])
  const body = kit.page.locator(`[data-slide-box] [data-node="${card.id}"] [data-body]`)
  await expect(body).toHaveCSS("box-shadow", /rgba?\(/)
}

export default { name: "design-effects", design: element, drive }
