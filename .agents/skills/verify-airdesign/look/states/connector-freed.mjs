import { freed } from "../../journeys/connector-follow.mjs"
import { editor } from "../editor-screen.mjs"

export default {
  name: "connector-freed",
  design: editor,
  drive: async (kit) => {
    await freed(kit)
  },
}
