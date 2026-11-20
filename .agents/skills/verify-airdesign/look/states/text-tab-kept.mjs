import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const slide = kit.page.locator("[data-slide-paint]")
  await slide.click({ position: { x: 4, y: 4 } })
  await kit.page.keyboard.press("t")
  const placing = kit.page.locator("[data-text-placing]")
  const room = await placing.boundingBox()
  await placing.click({ position: { x: (room?.width ?? 0) * 0.2, y: (room?.height ?? 0) * 0.8 } })
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]:focus').waitFor()
  await kit.page.keyboard.type("Revenue")
  await kit.page.keyboard.press("Tab")
  await kit.page.keyboard.type(" grew")
}

export default { name: "text-tab-kept", design: editor, drive }
