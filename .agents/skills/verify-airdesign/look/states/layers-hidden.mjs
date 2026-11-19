import { transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "frame.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator("[data-design-mode]").click()
  const layers = kit.page.locator("[data-layers-panel]")
  await layers.locator("[data-layer-caret]").first().click()
  const row = layers.getByRole("treeitem").nth(1)
  await row.click()
  const eye = row.locator("[data-layer-eye]")
  if ((await eye.count()) === 0) return
  await row.hover()
  await eye.click()
  await kit.page.locator("[data-layer-row][data-layer-hidden]").waitFor()
}

export default { name: "layers-hidden", design: "/screens/s43-10-editor-tools-layers", drive }
