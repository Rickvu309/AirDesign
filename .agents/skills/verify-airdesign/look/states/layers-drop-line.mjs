import { heldDrop } from "./layers-drop-inside.mjs"

export default {
  name: "layers-drop-line",
  design: "/screens/s43-10-editor-tools-layers",
  drive: (kit) => heldDrop(kit, "line"),
}
