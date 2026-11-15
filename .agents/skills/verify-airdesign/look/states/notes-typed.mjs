import { notesState } from "../notes-deck.mjs"
import { editor } from "../editor-screen.mjs"

export default {
  name: "notes-typed",
  design: editor,
  drive: async (kit) => {
    await notesState(kit, true)
    await kit.page.keyboard.type("Start with the bill savings.")
  },
}
