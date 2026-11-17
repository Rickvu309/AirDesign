import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]').click()
  await kit.page.keyboard.press("Escape")
}

export default { name: "text-link", design: "/screens/s43-08-editor-tools-text-format", drive }
