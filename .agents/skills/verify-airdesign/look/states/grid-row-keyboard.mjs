import { rowMoveState } from "../grid-row-move.mjs"

export default {
  name: "grid-row-keyboard",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => rowMoveState(kit, "keyboard"),
}
