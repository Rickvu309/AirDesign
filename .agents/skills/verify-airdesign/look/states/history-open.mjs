import { historyOpen } from "../chat-history.mjs"
import { editor } from "../editor-screen.mjs"

export default { name: "history-open", design: editor, drive: (kit) => historyOpen(kit) }
