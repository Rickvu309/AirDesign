import { notesState } from "../notes-deck.mjs"
import { editor } from "../editor-screen.mjs"

export default { name: "notes-closed", design: editor, drive: (kit) => notesState(kit) }
