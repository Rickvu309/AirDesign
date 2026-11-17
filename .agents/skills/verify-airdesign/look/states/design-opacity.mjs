import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  const field = panel.getByRole("textbox", { name: "Opacity", exact: true })
  await field.fill("60")
  await field.press("Enter")
  await expect(kit.page.getByRole("button", { name: "Undo opacity", exact: true })).toBeVisible()
}

export default { name: "design-opacity", design: "/screens/s43-09-editor-tools-design-element", drive }
