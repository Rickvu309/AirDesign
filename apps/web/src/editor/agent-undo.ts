import type * as doom from "@airdesign/doom"
import type { UndoRun } from "@/aira/aira-undo"
import { layerLabel } from "./layer-label"
import type { EditorClient } from "./use-deck"

export function undoAgentRun(client: Pick<EditorClient, "undoRun" | "view">): UndoRun {
  return async (_deck, run) => {
    if (client.view().runs.get(run)?.undone === true) return { kept: [], left: [], waiting: [], undone: true }
    const turned = await client.undoRun(run)
    const named = (ids: readonly doom.NodeId[]) => ids.map((id) => layerLabel(client.view(), id))
    if (turned.ok || turned.reason === "left")
      return { kept: named(turned.kept), left: named(turned.left), waiting: named(turned.waiting), undone: turned.ok }
    if (turned.reason === "size") return "size"
    if (turned.reason === "refused" && turned.refused.prop === "instance") return "rebuild"
    return turned.reason === "offline" ? "failed" : "refused"
  }
}
