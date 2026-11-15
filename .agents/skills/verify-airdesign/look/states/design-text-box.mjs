import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "clean.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, "Text box")
  const section = panel
    .locator("section")
    .filter({ has: kit.page.getByRole("heading", { name: "Text box", exact: true }) })
  if ((await section.count()) === 0) return
  await section
    .getByRole("group", { name: "Vertical alignment", exact: true })
    .getByRole("button", { name: "Bottom" })
    .click()
  const left = section
    .getByRole("group", { name: "Margins", exact: true })
    .getByRole("textbox", { name: "Left", exact: true })
  await left.fill("36")
  await left.press("Enter")
  await expect(kit.page.getByRole("button", { name: "Undo text box", exact: true })).toBeVisible()
  await section.getByRole("heading", { name: "Text box", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-text-box", design: "/screens/s43-09-editor-tools-design-element", drive }
