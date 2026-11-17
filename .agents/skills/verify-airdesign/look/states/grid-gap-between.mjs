import { gapAddState } from "../grid-gap-add.mjs"

export default {
  name: "grid-gap-between",
  design: "/screens/s41-02-editor-grid-add-slide-hover",
  drive: (kit) => gapAddState(kit, "between"),
}
