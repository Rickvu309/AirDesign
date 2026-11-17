import { rowMoveState } from "../grid-row-move.mjs"

export default {
  name: "grid-row-drag",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => rowMoveState(kit, "drag"),
}
