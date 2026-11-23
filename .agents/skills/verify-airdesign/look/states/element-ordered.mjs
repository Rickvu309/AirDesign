import { expect } from "@playwright/test"
import { accent, clickSlide, openDoomDeck, readDoom, spot } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit, [
    {
      id: "t:1",
      props: { name: "Back card", box: spot(1100, 300, 480, 320), geometry: { kind: "rect" }, fills: accent },
    },
    {
      id: "t:2",
      props: {
        name: "Front badge",
        box: spot(1300, 160, 360, 300),
        geometry: { kind: "ellipse" },
        fills: [{ kind: "solid", color: { var: "accent2" } }],
      },
    },
  ])
  await clickSlide(page, 1160, 580)
  await expect(page.locator('[data-selection-outline="t:1"]')).toBeAttached()
  await page.keyboard.press("ControlOrMeta+Shift+BracketRight")
  const order = async () => {
    const nodes = Object.values((await readDoom(kit, opened)).fold.nodes)
    const at = (id) => nodes.find((each) => each.id === id).parent.at
    return at("t:1") > at("t:2")
  }
  await expect.poll(order).toBe(true)
}

export default { name: "element-ordered", design: editor, drive }
