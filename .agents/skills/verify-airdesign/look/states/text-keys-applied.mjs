import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "clean.pptx")
  await page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]').click()
  for (const key of ["ControlOrMeta+Shift+KeyX", "ControlOrMeta+Shift+Period", "ControlOrMeta+Alt+KeyT"])
    await page.keyboard.press(key)
}

export default { name: "text-keys-applied", design: "/screens/s43-08-editor-tools-text-format", drive }
