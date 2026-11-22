import { useMemo } from "react"
import { AiraPanel } from "@/aira-panel"
import { sceneAgentUndo } from "./scene-agent-undo"
import type { EditorClient } from "./use-scene-deck"

export function AgentPanel({ deck }: { readonly deck: Pick<EditorClient, "deck" | "undoRun"> }) {
  const undo = useMemo(() => sceneAgentUndo(deck), [deck])
  return <AiraPanel key={deck.deck} deck={deck.deck} hidden={false} undo={undo} />
}
