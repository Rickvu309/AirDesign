import { fillWords, formatCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

const shape = (number) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${number}"]`

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator(shape(4)).click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await panel.getByRole("group", { name: fillWords.color, exact: true }).getByRole("button").first().click()
  await kit.page
    .locator("[data-color-picker]")
    .getByRole("button", { name: formatCopy.colors.accent2, exact: true })
    .click()
  await kit.page.keyboard.press("Escape")
  await kit.page.locator(shape(5)).click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  await expect(kit.page.locator("[data-chosen]")).toHaveCount(2)
  await expect(kit.page.locator("[data-selection-around]")).toHaveAttribute("data-selection-around", "2")
}

export default { name: "two-shapes-panel", design: "/screens/s43-09-editor-tools-design-element", drive }
