import { historyOpen } from "../chat-history.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await historyOpen(
    kit,
    "Make the Q3 investor update lead with the number that matters most to the board, then the three risks behind it. Keep it calm.",
  )
}

export default { name: "history-long-title", design: editor, drive }
