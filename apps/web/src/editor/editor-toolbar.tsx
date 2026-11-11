import { Button } from "@/components/ui/button"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { PanelSwitch } from "@/editor/panel-switch"
import { cn } from "@/lib/class-names"

export type EditorTool = "move" | "text" | "shape" | "image" | "actions"

export type EditorPanel = "agent" | "design" | "none"

const tools: { tool: Exclude<EditorTool, "move">; icon: EditorIconName }[] = [
  { tool: "text", icon: "text" },
  { tool: "shape", icon: "shape" },
  { tool: "image", icon: "image" },
  { tool: "actions", icon: "actions" },
]

export function EditorToolbar({
  activeTool = "move",
  menuOpen = false,
  panel = "agent",
}: {
  activeTool?: EditorTool
  menuOpen?: boolean
  panel?: EditorPanel
}) {
  const moveOn = activeTool === "move"
  return (
    <div className="relative flex items-center gap-1 rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]">
      <span className="flex items-center gap-0.5">
        <Button
          type="button"
          variant={moveOn ? "default" : "ghost"}
          size="icon"
          aria-label="Move"
          aria-pressed={moveOn}
          className={cn(
            "size-9 rounded-lg active:translate-y-0",
            moveOn ? "hover:bg-primary-strong" : "text-quiet hover:bg-transparent",
          )}
        >
          <EditorIcon name="cursor" size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Tools"
          aria-expanded={menuOpen}
          className={cn(
            "h-9 w-4 rounded-[var(--shape-control)] px-0 text-quiet active:translate-y-0",
            menuOpen ? "bg-line hover:bg-line" : "hover:bg-transparent",
          )}
        >
          <EditorIcon name="chev" size={12} />
        </Button>
      </span>
      {tools.map(({ tool, icon }) => {
        const on = activeTool === tool
        return (
          <Button
            key={tool}
            type="button"
            variant={on ? "default" : "ghost"}
            size="icon"
            aria-label={tool}
            aria-pressed={on}
            className={cn(
              "size-9 rounded-lg active:translate-y-0",
              on ? "hover:bg-primary-strong" : "text-quiet hover:bg-transparent",
            )}
          >
            <EditorIcon name={icon} size={18} />
          </Button>
        )
      })}
      {panel === "none" ? null : (
        <>
          <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
          <PanelSwitch active={panel} />
        </>
      )}
      {menuOpen ? <ToolMenu /> : null}
    </div>
  )
}

function ToolMenu() {
  return (
    <div className="absolute bottom-[52px] left-[42px] flex w-[188px] flex-col rounded-xl bg-foreground p-1.5 shadow-[0px_8px_24px_var(--black-20)]">
      <MenuRow icon="cursor" label="Move" shortcut="V" checked />
      <MenuRow icon="hand" label="Hand tool" shortcut="H" />
    </div>
  )
}

function MenuRow({
  icon,
  label,
  shortcut,
  checked = false,
}: {
  icon: EditorIconName
  label: string
  shortcut: string
  checked?: boolean
}) {
  return (
    <div className="flex h-8 items-center gap-2.5 rounded-md pr-2.5 pl-2 text-white">
      <span className="flex size-4 items-center justify-center">
        {checked ? <EditorIcon name="check" size={14} /> : null}
      </span>
      <EditorIcon name={icon} size={16} />
      <span className="flex-1 text-[length:var(--type-dense)]">{label}</span>
      <span className="text-xs text-[var(--shortcut)]">{shortcut}</span>
    </div>
  )
}
