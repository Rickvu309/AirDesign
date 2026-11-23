import { editor } from "../editor-screen.mjs"
import { landNodes, openDoomDeck, spot } from "../doom-deck.mjs"
import { emptySlide } from "../doom-slides.mjs"

const stops = [
  { at: 0, color: "#ffd54a" },
  { at: 1, color: "#1f4e9e" },
]
const gradient = (id, name, y, shape, angle) => ({
  id,
  props: {
    name,
    box: spot(1040, y, 720, 400),
    geometry: { kind: "rect" },
    fills: [{ kind: "gradient", shape, angle, stops }],
  },
})
const line = (id, name, y, dash) => ({
  id,
  props: {
    name,
    box: spot(160, y, 720, 0),
    geometry: { kind: "line", start: { x: 160, y }, end: { x: 880, y }, route: "straight", arrows: ["none", "none"] },
    strokes: [{ kind: "solid", color: "#c0392b" }],
    stroke: { weight: 8, align: "center", dash },
  },
})

const shapes = [
  gradient("g:1", "Gradient from the centre", 100, "radial", 0),
  gradient("g:2", "Gradient along the edge", 580, "linear", 45),
  line("g:3", "Dot line", 260, "dot"),
  line("g:4", "Dash line", 520, "dash"),
  line("g:5", "Solid line", 780, "solid"),
]

async function drive(kit) {
  const opened = await openDoomDeck(kit)
  await emptySlide(kit, opened)
  await landNodes(kit, opened, shapes)
}

export default { name: "slide-line-and-gradient", design: editor, drive }
