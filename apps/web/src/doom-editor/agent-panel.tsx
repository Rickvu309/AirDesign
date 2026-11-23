import type * as doom from "@airdesign/doom"
import { useMemo } from "react"
import { AiraPanel, type AiraStart } from "@/aira/aira-panel"
import { AgentRuns } from "./agent-runs"
import { doomAgentUndo } from "./doom-agent-undo"
import type { EditorClient } from "./use-doom-deck"

export function AgentPanel({
  deck,
  view,
  editing = new Set(),
  start,
}: {
  readonly deck: Pick<EditorClient, "deck" | "undoRun" | "view">
  readonly view: doom.Doom
  readonly editing?: ReadonlySet<string>
  readonly start?: AiraStart
}) {
  const undo = useMemo(() => doomAgentUndo(deck), [deck])
  return (
    <AiraPanel
      key={deck.deck}
      deck={deck.deck}
      hidden={false}
      undo={undo}
      runs={<AgentRuns view={view} editing={editing} undoRun={deck.undoRun} />}
      undoneRun={(run) => view.runs.get(run)?.undone}
      {...(start === undefined ? {} : { start })}
    />
  )
}
