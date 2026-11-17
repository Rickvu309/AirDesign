import { expect } from "@playwright/test"
import { boxCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await kit.page.keyboard.press("Escape")
  const panel = kit.page.locator("[data-design-element]")
  await unfold(panel, boxCopy.section)
  const x = panel.getByRole("textbox", { name: "X", exact: true })
  await x.fill("96")
  await x.press("Enter")
  await panel.getByRole("button", { name: "Bold", exact: true }).click()
  await panel.getByRole("group", { name: "Text color" }).getByRole("button").first().click()
  await kit.page.locator("[data-color-picker]").getByRole("button", { name: "Accent 2", exact: true }).click()
  await kit.page.keyboard.press("Escape")
  await panel
    .getByRole("group", { name: "Alignment", exact: true })
    .getByRole("button", { name: "Center", exact: true })
    .click()
  await expect(panel.getByRole("button", { name: "Bold", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(kit.page.getByRole("button", { name: "Undo text format", exact: true })).toBeVisible()
}

export default { name: "design-element-changed", design: "/screens/s43-09-editor-tools-design-element", drive }
