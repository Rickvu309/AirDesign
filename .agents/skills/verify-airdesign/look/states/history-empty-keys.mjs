import { historyEmptyByKeys } from "../chat-history.mjs"
import { editor } from "../editor-screen.mjs"

export default { name: "history-empty-keys", design: editor, drive: historyEmptyByKeys }
