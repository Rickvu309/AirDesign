import { editor } from "../editor-screen.mjs"
import { centre, hold, solid } from "../doom-canvas.mjs"
import { accent, openDoomDeck, slidePoint, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    { id: "w:1", props: { name: "First", box: spot(860, 300, 220, 220), geometry: { kind: "rect" }, fills: accent } },
    { id: "w:2", props: { name: "Second", box: spot(1200, 300, 220, 220), geometry: { kind: "rect" }, fills: accent } },
    {
      id: "w:3",
      props: { name: "Third", box: spot(1600, 640, 220, 220), geometry: { kind: "rect" }, fills: solid("accent2") },
    },
  ])
  const from = await centre(page, "w:3")
  const target = await slidePoint(page, 1540 + 110 + 6, 300 + 110 + 3)
  await hold(page, from, target, 10)
}

export default { name: "layer-spacing-held", design: editor, drive }
