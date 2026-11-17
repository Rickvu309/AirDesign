import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "doe-heat-pumps.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator("[data-design-panel] [data-template-style]").click()
  await expect(kit.page.locator('[data-slot="popover-content"] [data-template-style]')).toHaveCount(2)
}

export default { name: "design-template-menu", design: "/screens/s43-02-editor-tools-design-panel", drive }
