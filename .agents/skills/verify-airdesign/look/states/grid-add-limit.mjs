import { groupAddState } from "../grid-group-add.mjs"

export default {
  name: "grid-add-limit",
  design: "/screens/s41-01-editor-grid-default",
  drive: (kit) => groupAddState(kit, "limit"),
}
