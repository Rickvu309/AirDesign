import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, "Shape type")
  const grid = panel.locator('[data-control="preset"]').getByRole("button", { name: /^Type\b/ })
  if ((await grid.count()) === 0) {
    await panel.getByRole("combobox", { name: "Type", exact: true }).click()
    await expect(kit.page.getByRole("listbox")).toBeVisible()
    return
  }
  await grid.click()
  await expect(kit.page.locator("[data-shape-grid]")).toBeVisible()
}

export default { name: "design-shape-type", design: "/screens/s43-09-editor-tools-design-element", drive }
