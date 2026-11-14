import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "table-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]').click()
  await kit.page.keyboard.press("Escape")
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
}

export default { name: "design-table", design: "/screens/s43-09-editor-tools-design-element", drive }
