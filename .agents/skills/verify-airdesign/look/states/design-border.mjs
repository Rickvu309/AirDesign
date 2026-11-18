import { unfold } from "../unfold.mjs"
import { appearanceCopy, borderCopy, transitionCopy, undoCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, appearanceCopy.border)
  const border = panel.locator(`[data-design-section="${appearanceCopy.border}"]`)
  const field = border.getByRole("textbox", { name: borderCopy.width, exact: true })
  await field.fill("6")
  await field.press("Enter")
  await expect(kit.page.getByRole("button", { name: undoCopy.undoNamed.border, exact: true })).toBeVisible()
  await border.scrollIntoViewIfNeeded()
}

export default { name: "design-border", design: "/screens/s43-09-editor-tools-design-element", drive }
