import { editor } from "../editor-screen.mjs"
import { deepPick, nested } from "../doom-canvas.mjs"

async function drive(kit) {
  await nested(kit)
  await deepPick(kit.page, "w:4")
}

export default { name: "group-layer-selected", design: editor, drive }
