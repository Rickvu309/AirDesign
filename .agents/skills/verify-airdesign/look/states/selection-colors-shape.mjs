import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-panel]")
  await expect(panel).toBeVisible()
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
}

export default { name: "selection-colors-shape", design: "/screens/s43-09-editor-tools-design-element", drive }
