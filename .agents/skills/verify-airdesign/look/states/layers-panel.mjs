import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "frame.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator("[data-design-mode]").click()
  const layers = kit.page.locator("[data-layers-panel]")
  await layers.locator("[data-layer-caret]").first().click()
  await layers.getByRole("treeitem").nth(1).click()
  await expect(layers.getByRole("treeitem").nth(1)).toHaveAttribute("aria-selected", "true")
}

export default { name: "layers-panel", design: "/screens/s43-10-editor-tools-layers", drive }
