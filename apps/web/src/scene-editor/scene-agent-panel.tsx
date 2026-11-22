import { useMemo } from "react"
import { AiraPanel } from "@/aira-panel"
import { ResizablePanel } from "@/editor/resizable-panel"
import { sceneAgentUndo } from "./scene-agent-undo"
import type { EditorClient } from "./use-scene-deck"

export function SceneAgentPanel({ deck, client }: { readonly deck: string; readonly client: EditorClient }) {
  const undo = useMemo(() => sceneAgentUndo(client), [client])
  return (
    <ResizablePanel panel="agent">
      <AiraPanel key={deck} deck={deck} hidden={false} undo={undo} />
    </ResizablePanel>
  )
}
