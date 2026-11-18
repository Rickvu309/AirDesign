import { editSlideSet } from "../grid-set-edits.mjs"

export default {
  name: "grid-set-delete",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => editSlideSet(kit, "remove"),
}
