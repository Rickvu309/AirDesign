import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  const shape = (id) => kit.page.locator(`[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${id}"]`)
  await shape(4).click({ position: { x: 4, y: 4 } })
  const line = await shape(6).boundingBox()
  if (line === null) throw new Error("connector")
  await kit.page.keyboard.down("Shift")
  await kit.page.mouse.click(line.x + line.width / 2, line.y)
  await kit.page.keyboard.up("Shift")
  await expect(kit.page.locator("[data-design-element]")).toHaveAttribute("data-design-element", /^\d+\.4 \d+\.6$/)
}

export default { name: "design-many-line", design: "/screens/s43-09-editor-tools-design-element", drive }
