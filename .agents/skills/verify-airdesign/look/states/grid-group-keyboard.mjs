import { groupMoveState } from "../grid-group-move.mjs"

export default {
  name: "grid-group-keyboard",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => groupMoveState(kit, "keyboard"),
}
