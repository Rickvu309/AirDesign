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
  const rotation = panel.getByRole("textbox", { name: "Rotation", exact: true })
  if ((await rotation.count()) === 0) return
  await rotation.fill("30")
  await rotation.press("Enter")
  await panel.getByRole("button", { name: "Flip vertically", exact: true }).click()
  await panel.getByRole("combobox", { name: "Type", exact: true }).click()
  await kit.page.getByRole("option", { name: "Right arrow", exact: true }).click()
  await expect(panel.getByRole("textbox", { name: "Adjust 2", exact: true })).toHaveValue("50000")
  await expect(kit.page.getByRole("button", { name: "Undo shape", exact: true })).toBeVisible()
}

export default { name: "design-shape", design: "/screens/s43-09-editor-tools-design-element", drive }
