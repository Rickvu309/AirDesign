import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "clean.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
}

export default { name: "design-template", design: "/screens/s43-02-editor-tools-design-panel", drive }
