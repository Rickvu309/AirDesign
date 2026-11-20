import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "clean.pptx")
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("ControlOrMeta+Backslash")
}

export default { name: "editor-ui-hidden", design: "/screens/s43-02-editor-tools-design-panel", drive }
