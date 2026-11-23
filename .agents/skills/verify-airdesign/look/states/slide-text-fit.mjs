import { openDoomDeck, spot, words } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

const lines = (count) => Array.from({ length: count }, (_, at) => `Line ${String(at + 1)} of the text`).join("\n")
const box = (id, name, at, resize, count) => ({
  id,
  props: {
    name,
    box: at,
    fills: [{ kind: "solid", color: { var: "accent1", tint: 0.85 } }],
    strokes: [{ kind: "solid", color: { var: "accent1" } }],
    stroke: { weight: 2, align: "inside", dash: "solid" },
    text: words(lines(count), { resize, paras: Array.from({ length: count }, () => ({})) }),
  },
})

async function drive(kit) {
  await openDoomDeck(kit, [
    box("t:1", "Fixed, overflowing", spot(100, 640, 400, 160), "fixed", 5),
    box("t:2", "Grows to fit", spot(560, 640, 400, 120), "height", 4),
    box("t:3", "Width and height", spot(1020, 640, 300, 120), "widthAndHeight", 2),
    box("t:4", "Cut at the edge", spot(1420, 640, 400, 160), "truncate", 6),
  ])
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export default { name: "slide-text-fit", design: editor, drive }
