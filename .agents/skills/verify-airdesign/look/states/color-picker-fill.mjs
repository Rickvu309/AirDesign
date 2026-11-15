import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await panel.getByRole("group", { name: "Fill", exact: true }).waitFor()
  await panel.locator('[data-control="color"]').first().getByRole("button").first().click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: "Theme colors" })).toBeVisible()
}

export default { name: "color-picker-fill", design: "/screens/s43-09-editor-tools-design-element", drive }
