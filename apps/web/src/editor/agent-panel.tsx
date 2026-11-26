import type * as doom from "@airdesign/doom"
import { pendingDoomFonts } from "@airdesign/render"
import { useMemo } from "react"
import { AiraPanel, type AiraStart } from "@/aira/aira-panel"
import { undoAgentRun } from "./agent-undo"
import type { EditorClient } from "./use-deck"

export function AgentPanel({
  deck,
  view,
  start,
  onWorking,
}: {
  readonly deck: Pick<EditorClient, "deck" | "undoRun" | "view">
  readonly view: doom.Doom
  readonly start?: AiraStart
  readonly onWorking?: (working: boolean) => void
}) {
  const undo = useMemo(() => undoAgentRun(deck), [deck])
  return (
    <AiraPanel
      key={deck.deck}
      deck={deck.deck}
      hidden={false}
      undo={undo}
      pendingFonts={() => pendingDoomFonts(document)}
      undoneRun={(run) => view.runs.get(run)?.undone}
      {...(start === undefined ? {} : { start })}
      {...(onWorking === undefined ? {} : { onWorking })}
    />
  )
}
