import type { UndoRun } from "@/aira-loop"
import type { EditorClient } from "./use-doom-deck"

export function doomAgentUndo(client: Pick<EditorClient, "undoRun">): UndoRun {
  return async (_deck, run) => {
    const turned = await client.undoRun(run)
    if (turned.ok) return "undone"
    return turned.reason === "offline" ? "failed" : "refused"
  }
}
