import { transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "frame.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator("[data-design-mode]").click()
  const layers = kit.page.locator("[data-layers-panel]")
  const row = layers.getByRole("treeitem").first()
  await row.waitFor()
  const lock = row.locator("[data-layer-lock]")
  if ((await lock.count()) === 0) return
  await row.hover()
  await lock.click()
  await kit.page.locator('[data-layer-lock][aria-pressed="true"]').waitFor()
  await kit.page.mouse.move(4, 4)
}

export default { name: "layers-locked", design: "/screens/s43-10-editor-tools-layers", drive }
