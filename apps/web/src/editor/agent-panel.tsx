import type * as doom from "@airdesign/doom"
import { pendingDoomFonts } from "@airdesign/render"
import { useMemo } from "react"
import { AiraPanel, type AiraStart } from "@/aira/aira-panel"
import { AgentRuns } from "./agent-runs"
import { undoAgentRun } from "./agent-undo"
import type { EditorClient } from "./use-deck"

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
  const undo = useMemo(() => undoAgentRun(deck), [deck])
  return (
    <AiraPanel
      key={deck.deck}
      deck={deck.deck}
      hidden={false}
      undo={undo}
      pendingFonts={() => pendingDoomFonts(document, deck.view())}
      runs={<AgentRuns view={view} editing={editing} undoRun={deck.undoRun} />}
      undoneRun={(run) => view.runs.get(run)?.undone}
      {...(start === undefined ? {} : { start })}
    />
  )
}
