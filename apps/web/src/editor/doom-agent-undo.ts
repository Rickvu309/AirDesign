import type * as doom from "@airdesign/doom"
import type { UndoRun } from "@/aira/aira-loop"
import { layerLabel } from "./layer-label"
import type { EditorClient } from "./use-doom-deck"

export function doomAgentUndo(client: Pick<EditorClient, "undoRun" | "view">): UndoRun {
  return async (_deck, run) => {
    if (client.view().runs.get(run)?.undone === true) return { kept: [], left: [] }
    const turned = await client.undoRun(run)
    const named = (ids: readonly doom.NodeId[]) => ids.map((id) => layerLabel(client.view(), id))
    if (turned.ok) return { kept: named(turned.kept), left: named(turned.left) }
    return turned.reason === "offline" ? "failed" : "refused"
  }
}
