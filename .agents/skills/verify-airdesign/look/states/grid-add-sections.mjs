import { rowAddState } from "../grid-row-add.mjs"

export default {
  name: "grid-add-sections",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => rowAddState(kit, "sections"),
}
