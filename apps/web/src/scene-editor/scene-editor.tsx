import { scene } from "@airdesign/document"
import { useState } from "react"
import { NotFoundPage } from "@/decks/not-found-page"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { CanvasTools } from "./canvas-tools"
import { EditorTopBar } from "./editor-top-bar"
import { slidesOf } from "./node-props"
import { SceneAgentPanel } from "./scene-agent-panel"
import { SceneCanvas } from "./scene-canvas"
import { noSelection, type Selection } from "./selection"
import type { Tool } from "./use-canvas-pointer"
import { useSceneDeck, useSceneView, type EditorClient } from "./use-scene-deck"

function deckName(view: scene.Scene): string {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  return deck?.type === "deck" ? (deck.name ?? "") : ""
}

function Editing({ client, id }: { readonly client: EditorClient; readonly id: string }) {
  const view = useSceneView(client)
  const slides = slidesOf(view)
  const slide = slides[0]
  const [selection, setSelection] = useState<Selection>(noSelection)
  const [tool, setTool] = useState<Tool>("move")
  return (
    <div className="window-frame flex" data-scene-editor={id}>
      <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
        <EditorTopBar name={deckName(view)} client={client} />
        <div className="relative flex min-h-0 flex-1 flex-col">
          {slide === undefined ? null : (
            <SceneCanvas
              deck={id}
              client={client}
              view={view}
              slide={slide}
              selection={selection}
              onSelection={setSelection}
              tool={tool}
              onTool={setTool}
            />
          )}
          <CanvasTools tool={tool} onTool={setTool} />
        </div>
      </div>
      <SceneAgentPanel deck={id} client={client} />
    </div>
  )
}

export function SceneEditor({ id }: { readonly id: string | null }) {
  const opening = useSceneDeck(id, {
    arrived: (made) => window.history.replaceState(null, "", `/s/${made}`),
  })
  if (opening.status === "missing") return <NotFoundPage kind="deck" />
  if (opening.status === "loading")
    return (
      <div className="window-frame" aria-busy="true" aria-label={sceneEditorCopy.loading}>
        <div className="h-full bg-canvas" />
      </div>
    )
  return <Editing client={opening.deck} id={opening.id} />
}
