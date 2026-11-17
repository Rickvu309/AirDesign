import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  const panel = kit.page.locator("[data-design-panel]")
  await expect(panel).toBeVisible()
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
}

export default { name: "selection-colors-slide", design: "/screens/s43-02-editor-tools-design-panel", drive }
