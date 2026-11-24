import { appearanceCopy } from "./appearance-copy"
import { frameCopy } from "./frame-copy"

const layerCount = (count: number, kind: string) =>
  `${new Intl.NumberFormat("en").format(count)} ${kind} ${count === 1 ? "layer" : "layers"}`

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  background: "Background",
  theme: "Theme",
  customTheme: "Custom theme",
  themeSample: "Aa",
  chooseTheme: (name: string) => `Change theme, ${name}`,
  backgroundColor: (name: string) => `Background color, ${name}`,
  ...appearanceCopy,
  panels: {
    shape: "Shape",
    connector: "Line",
    group: "Group",
    frame: frameCopy.frame,
    kept: "Layer",
  },
  selected: (count: number) => `${String(count)} selected`,
  selectMatching: "Select matching layers",
  titles: { text: "Text", picture: "Image", icon: "Icon" },
  autoFrame: frameCopy.autoFrame,
  removeAutoLayout: frameCopy.removeAutoLayout,
  square: "Rectangle",
  layerName: "Layer name",
  layerNameEmpty: "Enter a name for this layer.",
  renameLayer: (name: string) => `Rename layer: ${name}`,
  nothing: "Nothing on this layer can be changed here yet.",
  mixed: "Mixed",
  points: "pt",
  percent: "%",
  degrees: "°",
  addStop: "Add stop",
  remove: "Remove",
  removeStop: (number: number) => `Remove stop ${String(number)}`,
  stop: (number: number) => `Stop ${String(number)}`,
  heldLayers: {
    hidden: (count: number) => layerCount(count, "hidden"),
    locked: (count: number) => layerCount(count, "locked"),
  },
  heldLayersBack: { hidden: "Show all", locked: "Unlock all" },
} as const
