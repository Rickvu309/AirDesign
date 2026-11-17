import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "element-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  const shape = (id) => kit.page.locator(`[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${id}"]`)
  await shape(2).click({ position: { x: 4, y: 4 } })
  await shape(3).click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  await expect(kit.page.locator("[data-design-element]")).toHaveAttribute("data-design-element", /^\d+\.2 \d+\.3$/)
}

export default { name: "design-many-text", design: "/screens/s43-09-editor-tools-design-element", drive }
