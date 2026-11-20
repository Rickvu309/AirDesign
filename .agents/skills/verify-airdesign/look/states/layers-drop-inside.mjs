import { transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

export async function heldDrop(kit, zone) {
  const { page } = kit
  await fixtureDeck(kit, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await layers.locator("[data-layer-caret]").first().click()
  const children = layers.locator('[data-layer-row][aria-level="2"]')
  const source = zone === "inside" ? children.last() : children.first()
  const target = zone === "inside" ? layers.locator('[data-layer-kind="frame"]').first() : children.last()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  const y = zone === "inside" ? to.y + to.height / 2 : to.y + to.height * 0.85
  const x = zone === "inside" ? to.x + 80 : to.x + 8
  await page.mouse.move(from.x + 80, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 8 })
  await page.mouse.move(x + 1, y)
  await layers
    .locator(`[data-layer-drop="${zone === "inside" ? "inside" : "below"}"]`)
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
}

export default {
  name: "layers-drop-inside",
  design: "/screens/s43-10-editor-tools-layers",
  drive: (kit) => heldDrop(kit, "inside"),
}
