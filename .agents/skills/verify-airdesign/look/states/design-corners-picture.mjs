import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "picture-png.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 8, y: 8 } })
  await expect(kit.page.locator("[data-design-element]")).toBeVisible()
}

export default { name: "design-corners-picture", design: "/screens/s43-09-editor-tools-design-element", drive }
