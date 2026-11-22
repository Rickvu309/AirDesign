import { ChevronLeft, Redo2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import type { EditorClient } from "./use-scene-deck"

export function EditorTopBar(props: { readonly name: string; readonly client: EditorClient }) {
  const { client } = props
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Button variant="ghost" size="icon-sm" aria-label={sceneEditorCopy.home} render={<a href="/" />}>
        <ChevronLeft />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium" data-deck-name="">
        {props.name}
      </h1>
      <Button variant="ghost" size="icon-sm" aria-label={sceneEditorCopy.undo} onClick={() => client.undo()}>
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={sceneEditorCopy.redo} onClick={() => client.redo()}>
        <Redo2 />
      </Button>
    </header>
  )
}
