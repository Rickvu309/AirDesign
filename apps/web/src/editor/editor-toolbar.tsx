import { Button } from "@/components/ui/button"
import { ActionsTool } from "@/editor/actions-menu"
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { EditorMenuContent, EditorMenuRow } from "@/editor/editor-menu"
import { FormatButtons, LiveFormatButtons, type FormatShown } from "@/editor/format-buttons"
import { PanelSwitch } from "@/editor/panel-switch"
import type { PointerTool, ToolPick } from "@/editor/pointer-tool"
import { UndoButtons, type UndoButtonsState } from "@/editor/undo-buttons"
import { cn } from "@/lib/class-names"
import type { TextFormatting } from "@airdesign/render"

export type EditorTool = "move" | "text" | "shape" | "image" | "actions"

export type EditorPanel = "agent" | "design" | "none"

const tools: { tool: Exclude<EditorTool, "move">; icon: EditorIconName }[] = [
  { tool: "text", icon: "text" },
  { tool: "shape", icon: "shape" },
  { tool: "image", icon: "image" },
  { tool: "actions", icon: "actions" },
]

const pointerTools: { tool: PointerTool; icon: EditorIconName; label: string; shortcut: string }[] = [
  { tool: "move", icon: "cursor", label: "Move", shortcut: "V" },
  { tool: "hand", icon: "hand", label: "Hand tool", shortcut: "H" },
]

function isPointerTool(value: unknown): value is PointerTool {
  return value === "move" || value === "hand"
}

export function EditorToolbar({
  activeTool = "move",
  menuOpen = false,
  panel = "agent",
  pointer,
  undo,
  onPanel,
  onText,
  formatting,
  formats,
  onTable,
}: {
  activeTool?: EditorTool
  menuOpen?: boolean
  panel?: EditorPanel
  pointer?: ToolPick
  undo?: UndoButtonsState
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  onText?: () => void
  formatting?: TextFormatting
  formats?: FormatShown
  onTable?: () => void
}) {
  const chosen = pointer?.tool ?? "move"
  const shown = pointerTools.find((each) => each.tool === chosen) ?? pointerTools[0]
  const pointerOn = pointer !== undefined || activeTool === "move"
  return (
    <div
      className="relative flex items-center gap-1 rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]"
      data-editor-toolbar
      data-keeps-format
    >
      <span className="flex items-center gap-0.5">
        <Button
          type="button"
          variant={pointerOn ? "default" : "ghost"}
          size="icon"
          aria-label={shown?.label ?? "Move"}
          aria-pressed={pointerOn}
          className={cn(
            "size-9 rounded-lg active:translate-y-0",
            pointerOn ? "hover:bg-primary-strong" : "text-quiet hover:bg-transparent",
          )}
          {...(pointer === undefined ? {} : { onClick: () => pointer.pick(chosen) })}
        >
          <EditorIcon name={shown?.icon ?? "cursor"} size={18} />
        </Button>
        <DropdownMenu modal={false} {...(pointer === undefined ? { open: menuOpen } : {})}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                aria-label="Tools"
                className="h-9 w-4 rounded-[var(--shape-control)] px-0 text-quiet hover:bg-transparent active:translate-y-0"
              />
            }
          >
            <EditorIcon name="chev" size={12} />
          </DropdownMenuTrigger>
          <EditorMenuContent side="top" align="start" sideOffset={12}>
            <DropdownMenuRadioGroup
              value={chosen}
              onValueChange={(value) => {
                if (pointer !== undefined && isPointerTool(value)) pointer.pick(value)
              }}
            >
              {pointerTools.map((each) => (
                <EditorMenuRow
                  key={each.tool}
                  value={each.tool}
                  icon={each.icon}
                  label={each.label}
                  shortcut={each.shortcut}
                  checked={each.tool === chosen}
                />
              ))}
            </DropdownMenuRadioGroup>
          </EditorMenuContent>
        </DropdownMenu>
      </span>
      {tools.map(({ tool, icon }) => {
        if (tool === "actions" && onTable !== undefined) return <ActionsTool key={tool} onTable={onTable} />
        const on = pointer === undefined && activeTool === tool
        const run = tool === "text" ? onText : undefined
        return (
          <Button
            key={tool}
            type="button"
            variant={on ? "default" : "ghost"}
            size="icon"
            aria-label={run === undefined ? tool : "Add text box"}
            {...(run === undefined ? { "aria-pressed": on } : {})}
            disabled={pointer !== undefined && run === undefined}
            {...(run === undefined ? {} : { onClick: run })}
            className={cn(
              "size-9 rounded-lg active:translate-y-0",
              on ? "hover:bg-primary-strong" : "text-quiet hover:bg-transparent",
            )}
          >
            <EditorIcon name={icon} size={18} />
          </Button>
        )
      })}
      {formatting === undefined ? null : <LiveFormatButtons formatting={formatting} />}
      {formats === undefined ? null : <FormatButtons shown={formats} />}
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <UndoButtons {...(undo === undefined ? {} : { state: undo })} />
      {panel === "none" ? null : (
        <>
          <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
          <PanelSwitch
            active={panel}
            designOff={pointer !== undefined}
            {...(onPanel === undefined ? {} : { onPick: onPanel })}
          />
        </>
      )}
    </div>
  )
}
