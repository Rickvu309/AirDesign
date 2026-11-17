import { gapAddState } from "../grid-gap-add.mjs"

export default {
  name: "grid-gap-end",
  design: "/screens/s41-02-editor-grid-add-slide-hover",
  drive: (kit) => gapAddState(kit, "end"),
}
