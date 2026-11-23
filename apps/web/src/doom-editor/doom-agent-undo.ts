import type { UndoRun } from "@/aira/aira-loop"
import { layerLabel } from "./layer-label"
import type { EditorClient } from "./use-doom-deck"

export function doomAgentUndo(client: Pick<EditorClient, "undoRun" | "view">): UndoRun {
  return async (_deck, run) => {
    const turned = await client.undoRun(run)
    if (turned.ok) return { kept: turned.kept.map((id) => layerLabel(client.view(), id)) }
    return turned.reason === "offline" ? "failed" : "refused"
  }
}
