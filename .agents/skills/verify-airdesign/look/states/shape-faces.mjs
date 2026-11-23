import { openDoomDeck, spot } from "../doom-deck.mjs"

const face = (id, name, x) => ({
  id,
  props: {
    name,
    box: spot(x, 300, 380, 380),
    geometry: { kind: "preset", name },
    fills: [{ kind: "solid", color: "#4472C4" }],
    strokes: [{ kind: "solid", color: "#1F4E79" }],
    stroke: { weight: 2, align: "center", dash: "solid" },
  },
})

async function drive(kit) {
  await openDoomDeck(kit, [face("w:1", "cube", 900), face("w:2", "can", 1420)])
}

export default { name: "shape-faces", design: null, drive }
