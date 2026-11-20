import { opacityCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]').click({
    position: { x: 4, y: 4 },
  })
  const opacity = kit.page
    .locator("[data-design-element]")
    .getByRole("textbox", { name: opacityCopy.label, exact: true })
  await opacity.fill("50")
  await opacity.press("Enter")
  await kit.page.keyboard.press("l")
  await kit.page.keyboard.press("Enter")
}

export default { name: "design-control-entered", design: "/screens/s43-09-editor-tools-design-element", drive }
