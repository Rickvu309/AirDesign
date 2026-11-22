import { useMemo } from "react"
import { AiraPanel } from "@/aira/aira-panel"
import { doomAgentUndo } from "./doom-agent-undo"
import type { EditorClient } from "./use-doom-deck"

export function AgentPanel({ deck }: { readonly deck: Pick<EditorClient, "deck" | "undoRun"> }) {
  const undo = useMemo(() => doomAgentUndo(deck), [deck])
  return <AiraPanel key={deck.deck} deck={deck.deck} hidden={false} undo={undo} />
}
