import { useMemo } from "react"
import { AiraPanel, type AiraStart } from "@/aira/aira-panel"
import { doomAgentUndo } from "./doom-agent-undo"
import type { EditorClient } from "./use-doom-deck"

export function AgentPanel({
  deck,
  start,
}: {
  readonly deck: Pick<EditorClient, "deck" | "undoRun" | "view">
  readonly start?: AiraStart
}) {
  const undo = useMemo(() => doomAgentUndo(deck), [deck])
  return (
    <AiraPanel
      key={deck.deck}
      deck={deck.deck}
      hidden={false}
      undo={undo}
      {...(start === undefined ? {} : { start })}
    />
  )
}
