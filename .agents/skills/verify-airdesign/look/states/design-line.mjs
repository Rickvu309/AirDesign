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
  const width = panel.locator("section").filter({ has: kit.page.getByRole("heading", { name: "Line", exact: true }) })
  if ((await width.count()) === 0) return
  const field = width.getByRole("textbox", { name: "Width", exact: true })
  await field.fill("6")
  await field.press("Enter")
  await expect(kit.page.getByRole("button", { name: "Undo line", exact: true })).toBeVisible()
  await width.getByRole("heading", { name: "Line", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-line", design: "/screens/s43-09-editor-tools-design-element", drive }
