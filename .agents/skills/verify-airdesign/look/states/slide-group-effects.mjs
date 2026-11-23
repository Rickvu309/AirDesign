import { editor } from "../editor-screen.mjs"
import { landNodes, openDoomDeck, spot } from "../doom-deck.mjs"
import { emptySlide } from "../doom-slides.mjs"

const solid = (color) => [{ kind: "solid", color }]
const linear = [
  {
    kind: "gradient",
    shape: "linear",
    angle: 0,
    stops: [
      { at: 0, color: "#2f6db5" },
      { at: 1, color: "#e76f51" },
    ],
  },
]
const radial = [{ ...linear[0], shape: "radial" }]
const shadow = [{ kind: "dropShadow", color: "#000000", opacity: 0.5, x: 12, y: 18, blur: 12, spread: 0 }]
const group = (id, name, box, effects, rotation = 0) => ({
  id,
  type: "frame",
  props: { name, box: spot(box[0], box[1], box[2], box[3], rotation), sizing: { w: "hug", h: "hug" }, effects },
})
const inside = (id, parent, name, box, geometry, fills) => ({
  id,
  parent,
  props: { name, box: spot(...box), geometry: { kind: geometry }, fills },
})

const shapes = [
  {
    id: "f:1",
    props: {
      name: "Soft linear gradient",
      box: spot(160, 120, 480, 260),
      geometry: { kind: "rect" },
      fills: linear,
      effects: "soft",
    },
  },
  {
    id: "f:2",
    props: {
      name: "Lifted radial gradient",
      box: spot(720, 120, 480, 260),
      geometry: { kind: "rect" },
      fills: radial,
      effects: "lifted",
    },
  },
  group("f:3", "Soft group", [1280, 120, 480, 260], "soft"),
  inside("f:4", "f:3", "Left", [0, 0, 280, 260], "ellipse", solid("#2f6db5")),
  inside("f:5", "f:3", "Right", [200, 0, 280, 260], "ellipse", solid("#2a9d8f")),
  group("f:6", "Shadow group", [160, 560, 480, 260], shadow),
  inside("f:7", "f:6", "Back", [0, 0, 320, 180], "rect", solid("#2f6db5")),
  inside("f:8", "f:6", "Front", [160, 80, 320, 180], "rect", solid("#e76f51")),
  group("f:9", "Glow group", [720, 600, 480, 160], "glow"),
  inside("f:10", "f:9", "One", [0, 0, 160, 160], "ellipse", solid("#2f6db5")),
  inside("f:11", "f:9", "Two", [160, 0, 160, 160], "ellipse", solid("#2a9d8f")),
  inside("f:12", "f:9", "Three", [320, 0, 160, 160], "ellipse", solid("#e76f51")),
  group("f:13", "Turned shadow group", [1280, 560, 480, 260], shadow, 30),
  inside("f:14", "f:13", "Bar", [0, 80, 480, 100], "rect", solid("#2f6db5")),
  inside("f:15", "f:13", "Mark", [190, 0, 100, 260], "rect", solid("#e76f51")),
]

async function drive(kit) {
  const opened = await openDoomDeck(kit)
  await emptySlide(kit, opened)
  await landNodes(kit, opened, shapes)
}

export default { name: "slide-group-effects", design: editor, drive }
