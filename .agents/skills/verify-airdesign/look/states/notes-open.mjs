import { notesState } from "../doom-notes-deck.mjs"
import { editor } from "../editor-screen.mjs"

export default { name: "notes-open", design: editor, drive: (kit) => notesState(kit, true) }
