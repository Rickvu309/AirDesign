import { following } from "../../journeys/connector-follow.mjs"
import { editor } from "../editor-screen.mjs"

export default {
  name: "connector-follow",
  design: editor,
  drive: async (kit) => {
    await following(kit)
  },
}
