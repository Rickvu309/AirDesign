import { Hash } from "lucide-react"
import { slideNumberCopy } from "@/copy/slide-number-copy"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { EditorMenuContent, EditorMenuRow } from "@/editor/editor-menu"
import { FormatButtons, useLiveFormat, type FormatProps, type FormatShown } from "@/editor/format-buttons"
import { PanelSwitch } from "@/editor/panel-switch"
import type { PointerTool, ToolPick } from "@/editor/pointer-tool"
import { UndoButtons, type UndoButtonsState } from "@/editor/undo-buttons"
import { cn } from "@/lib/class-names"
import type { TextFormatting } from "@airdesign/render"
import { pictureCopy } from "@/copy/picture-copy"
import { pickPicture } from "@/editor/picture-picker"
import { IconTool } from "@/editor/icon-tool"
import { ShapeTool } from "@/editor/shape-tool"
import type { Geometry } from "@airdesign/document"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toolbarCopy } from "@/copy/toolbar-copy"
import {
  formatParts,
  insertParts,
  toolbarFold,
  type FormatPart,
  type InsertPart,
  type ToolbarPart,
} from "@/editor/toolbar-fold"
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { flushSync } from "react-dom"

export type EditorTool = "move" | "text" | "shape" | "image" | "icon"

export type EditorPanel = "agent" | "design" | "none"

const toolIcons: Readonly<Record<Exclude<InsertPart, "number">, EditorIconName>> = {
  text: "text",
  shape: "shape",
  image: "image",
  icon: "icon",
}

const toolbarLook = "rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]"

const pointerTools: { tool: PointerTool; icon: EditorIconName; label: string; shortcut: string }[] = [
  { tool: "move", icon: "cursor", label: "Move", shortcut: "V" },
  { tool: "hand", icon: "hand", label: "Hand tool", shortcut: "H" },
]

function isPointerTool(value: unknown): value is PointerTool {
  return value === "move" || value === "hand"
}

function isInsertPart(part: ToolbarPart): part is InsertPart {
  return insertParts.some((each) => each === part)
}

function isFormatPart(part: ToolbarPart): part is FormatPart {
  return formatParts.some((each) => each === part)
}

function holdCaret(event: MouseEvent) {
  event.preventDefault()
}

function Divider() {
  return <span className="mx-1 block h-6 w-px shrink-0 bg-[var(--field-edge)]" />
}

type Inserts = {
  readonly activeTool: EditorTool
  readonly pointer: ToolPick | undefined
  readonly onSlideNumber: (() => void) | undefined
  readonly onText: (() => void) | undefined
  readonly onPicture: ((file: File) => void) | undefined
  readonly onShape: ((geometry: Geometry) => void) | undefined
  readonly onIcon: ((name: string) => void) | undefined
}

function InsertTool({ tool, inserts }: { tool: InsertPart; inserts: Inserts }) {
  const { activeTool, pointer, onText, onPicture, onShape, onIcon, onSlideNumber } = inserts
  if (tool === "number")
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={slideNumberCopy.title}
        className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0"
        onClick={onSlideNumber}
      >
        <Hash size={18} />
      </Button>
    )
  if (tool === "shape" && onShape !== undefined) return <ShapeTool onShape={onShape} />
  if (tool === "icon" && onIcon !== undefined) return <IconTool onIcon={onIcon} />
  const on = pointer === undefined && activeTool === tool
  const run =
    tool === "text" ? onText : tool === "image" && onPicture !== undefined ? () => pickPicture(onPicture) : undefined
  const label = tool === "text" ? "Add text box" : tool === "icon" ? pictureCopy.addIcon : pictureCopy.add
  return (
    <Button
      type="button"
      variant={on ? "default" : "ghost"}
      size="icon"
      aria-label={run === undefined ? tool : label}
      {...(run === undefined ? { "aria-pressed": on } : {})}
      disabled={pointer !== undefined && run === undefined}
      {...(run === undefined ? {} : { onClick: run })}
      className={cn(
        "size-9 rounded-lg active:translate-y-0",
        on ? "hover:bg-primary-strong" : "text-quiet hover:bg-transparent",
      )}
    >
      <EditorIcon name={toolIcons[tool]} size={18} />
    </Button>
  )
}

function ToolbarParts({
  parts,
  inRow,
  inserts,
  format,
}: {
  parts: readonly ToolbarPart[]
  inRow: boolean
  inserts: Inserts
  format: FormatProps | null
}) {
  const tools = parts.filter(isInsertPart)
  const formats = parts.filter(isFormatPart)
  return (
    <>
      {tools.map((tool) => (
        <InsertTool key={tool} tool={tool} inserts={inserts} />
      ))}
      {formats.length > 0 && (inRow || tools.length > 0) ? <Divider /> : null}
      {format === null || formats.length === 0 ? null : <FormatButtons {...format} parts={formats} />}
    </>
  )
}

function MoreTools({
  parts,
  inserts,
  format,
  open,
  onOpen,
}: {
  parts: readonly ToolbarPart[]
  inserts: Inserts
  format: FormatProps | null
  open: boolean
  onOpen: (open: boolean) => void
}) {
  return (
    <Popover modal={false} open={open} onOpenChange={onOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={toolbarCopy.more}
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 aria-expanded:bg-line aria-expanded:text-foreground"
            onMouseDown={holdCaret}
          />
        }
      >
        <EditorIcon name="more" size={18} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className={cn("w-auto flex-row items-center gap-1 ring-0 duration-0", toolbarLook)}
        data-keeps-format
        data-toolbar-more
      >
        <ToolbarParts parts={parts} inRow={false} inserts={inserts} format={format} />
      </PopoverContent>
    </Popover>
  )
}

function useFold(parts: readonly ToolbarPart[]) {
  const room = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const shape = parts.join(" ")
  const [fit, setFit] = useState({ fold: 0, shape, width: 0 })
  const [open, setOpen] = useState(false)
  if (fit.shape !== shape && !open) setFit({ fold: 0, shape, width: fit.width })
  useLayoutEffect(() => {
    const space = room.current?.clientWidth ?? 0
    const width = bar.current?.offsetWidth ?? 0
    if (space > 0 && width > space && fit.fold < parts.length) setFit({ ...fit, fold: fit.fold + 1 })
  })
  useLayoutEffect(() => {
    const node = room.current
    if (node === null || typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth
      flushSync(() => setFit((now) => (now.width === width ? now : { ...now, fold: 0, width })))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const onOpen = (next: boolean) => {
    setOpen(next)
    if (!next) setFit({ fold: 0, shape, width: fit.width })
  }
  const folded = toolbarFold(parts, fit.fold)
  if (open && folded.more.length === 0) setOpen(false)
  return { room, bar, ...folded, open, onOpen }
}

export function EditorToolbar({
  activeTool = "move",
  menuOpen = false,
  panel = "agent",
  pointer,
  undo,
  onPanel,
  onText,
  onSlideNumber,
  formatting,
  deckColors,
  formats,
  onPicture,
  onShape,
  onIcon,
}: {
  activeTool?: EditorTool
  menuOpen?: boolean
  panel?: EditorPanel
  pointer?: ToolPick
  undo?: UndoButtonsState
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  onText?: () => void
  onSlideNumber?: () => void
  formatting?: TextFormatting
  deckColors?: readonly string[]
  formats?: FormatShown
  onPicture?: (file: File) => void
  onShape?: (geometry: Geometry) => void
  onIcon?: (name: string) => void
}) {
  const chosen = pointer?.tool ?? "move"
  const shown = pointerTools.find((each) => each.tool === chosen) ?? pointerTools[0]
  const pointerOn = pointer !== undefined || activeTool === "move"
  const live = useLiveFormat(formatting, deckColors)
  const format = live ?? (formats === undefined ? null : { shown: formats })
  const available = insertParts.filter((part) => part !== "number" || onSlideNumber !== undefined)
  const fold = useFold(format === null ? available : [...available, ...formatParts])
  const inserts: Inserts = { activeTool, pointer, onText, onPicture, onShape, onIcon, onSlideNumber }
  return (
    <div ref={fold.room} className="flex w-full min-w-0 justify-center">
      <div
        ref={fold.bar}
        className={cn("group/toolbar pointer-events-auto relative flex shrink-0 items-center gap-1", toolbarLook)}
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
        <ToolbarParts parts={fold.row} inRow inserts={inserts} format={format} />
        {fold.more.length === 0 ? null : (
          <MoreTools parts={fold.more} inserts={inserts} format={format} open={fold.open} onOpen={fold.onOpen} />
        )}
        <Divider />
        <UndoButtons {...(undo === undefined ? {} : { state: undo })} />
        {panel === "none" ? null : (
          <>
            <Divider />
            <PanelSwitch active={panel} {...(onPanel === undefined ? {} : { onPick: onPanel })} />
          </>
        )}
      </div>
    </div>
  )
}
