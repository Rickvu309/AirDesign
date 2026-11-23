import { editor } from "../editor-screen.mjs"
import { landNodes, openDoomDeck, spot } from "../doom-deck.mjs"
import { emptySlide } from "../doom-slides.mjs"

const blue = [{ kind: "solid", color: "#2f6db5" }]
const shadow = (x, y, blur, more = {}) => ({
  kind: "dropShadow",
  color: "#000000",
  opacity: 0.45,
  x,
  y,
  blur,
  spread: 0,
  ...more,
})
const shape = (id, name, column, row, geometry, effects, more = {}) => ({
  id,
  props: {
    name,
    box: spot(160 + column * 580, 120 + row * 320, 440, 220, more.rotation ?? 0),
    geometry,
    fills: more.fills ?? blue,
    effects,
    ...(more.strokes === undefined
      ? {}
      : { strokes: more.strokes, stroke: { weight: 6, align: "inside", dash: "solid" } }),
  },
})

const shapes = [
  shape("e:1", "Soft style", 0, 0, { kind: "rect" }, "soft"),
  shape("e:2", "Lifted style", 1, 0, { kind: "rect" }, "lifted", { fills: blue }),
  shape("e:3", "Triangle shadow", 2, 0, { kind: "preset", name: "triangle" }, [shadow(12, 18, 12)]),
  shape("e:4", "Glow style", 0, 1, { kind: "ellipse" }, "glow"),
  shape("e:5", "Inner shadow", 1, 1, { kind: "rect" }, [
    { kind: "innerShadow", color: "#000000", opacity: 0.5, x: 0, y: 10, blur: 24, spread: 0 },
  ]),
  shape("e:6", "Turned shadow", 2, 1, { kind: "rect" }, [shadow(18, 18, 12)], { rotation: 15 }),
  shape("e:7", "Outline shadow", 0, 2, { kind: "rect" }, [shadow(10, 10, 8)], {
    fills: [],
    strokes: [{ kind: "solid", color: "#1d3557" }],
  }),
  shape("e:8", "Spread shadow", 1, 2, { kind: "rect" }, [shadow(0, 0, 16, { spread: 20 })]),
  shape("e:9", "Blurred", 2, 2, { kind: "rect" }, [{ kind: "layerBlur", radius: 12 }]),
]

async function drive(kit) {
  const opened = await openDoomDeck(kit)
  await emptySlide(kit, opened)
  await landNodes(kit, opened, shapes)
}

export default { name: "slide-effects", design: editor, drive }
