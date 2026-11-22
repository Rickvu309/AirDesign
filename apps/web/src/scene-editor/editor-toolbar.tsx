import { Check, ChevronDown } from "lucide-react"
import { memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { PanelSwitch } from "@/editor/panel-switch"
import { ShapeTool } from "@/editor/shape-tool"
import { cn } from "@/lib/class-names"
import { ActionsPanel, type ActionRun } from "./actions-popover"
import { toolForShape } from "./shape-tool-picks"
import type { Tool } from "./use-canvas-pointer"

export type RightPanel = "agent" | "design"

function ActionsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M7 2.5 11.5 7 7 11.5 2.5 7z" />
      <circle cx="17" cy="7" r="4" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <path d="M17 13v8M13 17h8" />
    </svg>
  )
}

function Divider() {
  return <span className="mx-1 block h-5.5 w-px shrink-0 bg-[var(--field-edge)]" />
}

const toolButton = "size-8 rounded-lg active:translate-y-0"
const armed =
  "bg-primary text-primary-foreground hover:bg-primary aria-expanded:bg-primary aria-expanded:text-primary-foreground"

const moves = [
  { tool: "move", icon: "cursor", label: sceneEditorCopy.toolMove, key: sceneEditorCopy.toolMoveKey },
  { tool: "hand", icon: "hand", label: sceneEditorCopy.toolHand, key: sceneEditorCopy.toolHandKey },
] as const satisfies readonly { tool: string; icon: EditorIconName; label: string; key: string }[]

export const EditorToolbar = memo(function EditorToolbar(props: {
  readonly tool: Tool
  readonly onTool: (next: Tool) => void
  readonly actionsOpen: boolean
  readonly onActionsOpen: (open: boolean) => void
  readonly run: ActionRun
  readonly panel: RightPanel
  readonly onPanel: (next: RightPanel) => void
}) {
  const { tool, onTool } = props
  const bar = useRef<HTMLDivElement>(null)
  const moving = tool === "move" || tool === "hand"
  const moveIcon = tool === "hand" ? "hand" : "cursor"
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={sceneEditorCopy.tools}
      className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]"
    >
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label={tool === "hand" ? sceneEditorCopy.toolHand : sceneEditorCopy.toolMove}
          aria-pressed={moving}
          className={cn(toolButton, moving ? armed : null)}
          onClick={() => onTool(tool === "hand" ? "hand" : "move")}
        >
          <EditorIcon name={moveIcon} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={sceneEditorCopy.moveTools}
                className="-ml-0.5 h-8 w-4 rounded-md"
              />
            }
          >
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={12}
            className="w-44 rounded-xl bg-menu-dark p-1.5 text-white ring-0"
          >
            {moves.map(({ tool: each, icon, label, key }) => (
              <DropdownMenuItem
                key={each}
                aria-current={tool === each ? "true" : undefined}
                onClick={() => onTool(each)}
                className={cn(
                  "h-8 gap-2 rounded-lg px-2 text-[length:var(--type-dense)] text-white focus:text-white",
                  tool === each ? "bg-primary focus:bg-primary" : "focus:bg-white/10",
                )}
              >
                <span className="flex size-4 items-center justify-center">
                  {tool === each ? <Check className="size-3.5" /> : null}
                </span>
                <EditorIcon name={icon} />
                <span className="flex-1">{label}</span>
                <kbd className="font-sans text-[length:var(--type-dense)] opacity-70">{key}</kbd>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Divider />
      <ShapeTool anchor={bar} onShape={(geometry) => onTool(toolForShape(geometry))} />
      <Button
        variant="ghost"
        size="icon"
        aria-label={sceneEditorCopy.textTool}
        aria-pressed={tool === "text"}
        className={cn(toolButton, tool === "text" ? armed : null)}
        onClick={() => onTool(tool === "text" ? "move" : "text")}
      >
        <EditorIcon name="text" />
      </Button>
      <Popover open={props.actionsOpen} onOpenChange={props.onActionsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={sceneEditorCopy.actions}
              aria-pressed={props.actionsOpen}
              className={cn(toolButton, props.actionsOpen ? armed : null)}
            />
          }
        >
          <ActionsIcon />
        </PopoverTrigger>
        <PopoverContent
          anchor={bar}
          side="top"
          align="center"
          sideOffset={12}
          className="w-75 rounded-2xl p-2"
          data-keeps-format
        >
          <ActionsPanel
            key={props.actionsOpen ? "open" : "closed"}
            run={props.run}
            finish={() => props.onActionsOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <Divider />
      <PanelSwitch active={props.panel} onPick={props.onPanel} />
    </div>
  )
})
