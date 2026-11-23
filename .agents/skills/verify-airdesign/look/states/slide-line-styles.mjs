import { editor } from "../editor-screen.mjs"
import { landNodes, openDoomDeck, spot } from "../doom-deck.mjs"
import { emptySlide } from "../doom-slides.mjs"

const red = [{ kind: "solid", color: "#c0392b" }]
const line = (id, name, y, weight, dash, arrows) => ({
  id,
  props: {
    name,
    box: spot(160, y, 800, 0),
    geometry: { kind: "line", start: { x: 160, y }, end: { x: 960, y }, route: "straight", arrows },
    strokes: red,
    stroke: { weight, align: "center", dash },
  },
})
const frame = (id, name, y, align) => ({
  id,
  props: {
    name,
    box: spot(1240, y, 480, 220),
    geometry: { kind: "rect" },
    fills: [],
    strokes: red,
    stroke: { weight: 24, align, dash: "solid" },
  },
})

const shapes = [
  line("l:1", "Thick dash", 120, 16, "dash", ["none", "none"]),
  line("l:2", "Dotted rule", 240, 8, "dot", ["none", "none"]),
  line("l:3", "Arrow end", 360, 6, "solid", ["none", "arrow"]),
  line("l:4", "Triangle end", 480, 6, "solid", ["none", "triangle"]),
  line("l:5", "Circle ends", 600, 6, "solid", ["circle", "circle"]),
  line("l:6", "Both arrows", 720, 4, "solid", ["arrow", "arrow"]),
  line("l:7", "Thin", 840, 2, "solid", ["none", "none"]),
  frame("l:8", "Inside border", 120, "inside"),
  frame("l:9", "Centre border", 420, "center"),
  frame("l:10", "Outside border", 720, "outside"),
]

async function drive(kit) {
  const opened = await openDoomDeck(kit)
  await emptySlide(kit, opened)
  await landNodes(kit, opened, shapes)
}

export default { name: "slide-line-styles", design: editor, drive }
