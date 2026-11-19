import { groupAddState } from "../grid-group-add.mjs"

export default {
  name: "grid-add-keyboard",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => groupAddState(kit, "keyboard"),
}
