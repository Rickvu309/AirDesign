import { around } from "../../journeys/connector-follow.mjs"
import { editor } from "../editor-screen.mjs"

export default {
  name: "connector-around",
  design: editor,
  drive: async (kit) => {
    await around(kit)
  },
}
