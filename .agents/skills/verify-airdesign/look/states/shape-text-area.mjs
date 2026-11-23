import { openDoomDeck, spot, words } from "../doom-deck.mjs"

const fill = [{ kind: "solid", color: { var: "accent1", tint: 0.8 } }]
const edge = [{ kind: "solid", color: { var: "accent1" } }]
const shape = (id, name, geometry, box, chars, more = {}) => ({
  id,
  props: {
    name,
    box,
    geometry,
    fills: fill,
    strokes: edge,
    stroke: { weight: 3, align: "inside", dash: "solid" },
    text: words(chars, { alignV: "center", paras: [{ align: "center" }], ...more }),
  },
})

async function drive(kit) {
  await openDoomDeck(kit, [
    shape("t:1", "Box with words", { kind: "rect" }, spot(1000, 120, 380, 240), "Words sit inside the rectangle"),
    shape("t:2", "Oval with words", { kind: "ellipse" }, spot(1440, 120, 380, 240), "Words keep inside the ellipse"),
    shape(
      "t:3",
      "Peak with words",
      { kind: "preset", name: "triangle" },
      spot(1000, 420, 380, 300),
      "Inside the triangle",
    ),
    shape(
      "t:4",
      "Rhombus with words",
      { kind: "preset", name: "diamond" },
      spot(1440, 420, 380, 300),
      "Inside the diamond",
    ),
    shape("t:5", "Top words", { kind: "rect" }, spot(1000, 780, 820, 200), "Words held to the top of a wide shape", {
      alignV: "top",
    }),
  ])
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export default { name: "shape-text-area", design: null, drive }
