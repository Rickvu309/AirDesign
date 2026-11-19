import { groupMoveState } from "../grid-group-move.mjs"

export default {
  name: "grid-group-drag",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => groupMoveState(kit, "drag"),
}
