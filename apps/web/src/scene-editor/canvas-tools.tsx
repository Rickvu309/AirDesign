import { Hand, MousePointer2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import type { Tool } from "./use-canvas-pointer"

const tools = [
  { tool: "move", icon: MousePointer2, label: sceneEditorCopy.toolMove },
  { tool: "text", icon: Type, label: sceneEditorCopy.textTool },
  { tool: "hand", icon: Hand, label: sceneEditorCopy.toolHand },
] as const

export function CanvasTools({ tool, onTool }: { readonly tool: Tool; readonly onTool: (next: Tool) => void }) {
  return (
    <div
      role="toolbar"
      aria-label={sceneEditorCopy.tools}
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]"
    >
      {tools.map(({ tool: each, icon: Icon, label }) => (
        <Button
          key={each}
          variant={tool === each ? "default" : "ghost"}
          size="icon"
          aria-label={label}
          aria-pressed={tool === each}
          onClick={() => onTool(each)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  )
}
