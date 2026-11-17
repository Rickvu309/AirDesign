import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { zoomCopy, zoomToOf } from "@/copy/product-copy"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { steppedZoom, typedZoom, zoomPresets, zoomRanges, type ZoomRange, type Zoom } from "@/editor/canvas-zoom"
import { EditorIcon } from "@/editor/editor-icons"
import { EditorMenuAction, EditorMenuContent, EditorMenuRow, EditorMenuRule } from "@/editor/editor-menu"

const menuKeys = new Set(["ArrowDown", "ArrowUp", "Escape", "Tab"])

function zoomOf(value: unknown): Zoom | null {
  if (value === "fit") return "fit"
  return zoomPresets.find((preset) => String(preset) === value) ?? null
}

function ZoomField({ percent, onZoom, range }: { percent: number; onZoom: (zoom: Zoom) => void; range: ZoomRange }) {
  const shown = `${String(percent)}%`
  const [text, setText] = useState(shown)
  const field = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (menuKeys.has(event.key)) return
    event.stopPropagation()
    if (event.key !== "Enter") return
    event.preventDefault()
    const next = typedZoom(text, range)
    if (next === null) setText(shown)
    else onZoom(next)
  }
  return (
    <input
      ref={field}
      aria-label={zoomCopy.field}
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      className="mx-5.5 my-1.5 h-8 rounded-md border-2 border-[var(--white-35)] bg-transparent px-2.5 text-[length:var(--type-dense)] text-white tabular-nums outline-none focus:border-primary"
      data-focus-edge
      data-zoom-field
    />
  )
}

export function ZoomMenu({
  zoom,
  percent,
  onZoom,
  onSelection,
  range = zoomRanges.slides,
}: {
  range?: ZoomRange
  zoom: Zoom
  percent: number
  onZoom: (zoom: Zoom) => void
  onSelection?: () => void
}) {
  const [open, setOpen] = useState(false)
  const choose = (next: Zoom) => {
    onZoom(next)
    setOpen(false)
  }
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-0.5 rounded-lg px-0 pr-1.5 pl-2.5 text-[length:var(--type-dense)] font-medium text-foreground tabular-nums hover:bg-line active:translate-y-0 aria-expanded:bg-primary/15 aria-expanded:text-[var(--tint-text)]"
          />
        }
        data-zoom-readout
      >
        {`${String(percent)}%`}
        <EditorIcon name="chev" size={12} className="text-faint" />
      </DropdownMenuTrigger>
      <EditorMenuContent side="bottom" align="end" sideOffset={10} className="w-[220px]">
        <ZoomField percent={percent} onZoom={choose} range={range} />
        <EditorMenuRule />
        <EditorMenuAction
          label={zoomCopy.zoomIn}
          shortcut={zoomCopy.inKey}
          keys="Control+= Meta+="
          onClick={() => onZoom(steppedZoom("in", percent, range))}
        />
        <EditorMenuAction
          label={zoomCopy.zoomOut}
          shortcut={zoomCopy.outKey}
          keys="Control+- Meta+-"
          onClick={() => onZoom(steppedZoom("out", percent, range))}
        />
        {onSelection === undefined ? null : (
          <EditorMenuAction
            label={zoomCopy.selection}
            shortcut={zoomCopy.selectionKey}
            keys="Shift+2"
            onClick={() => {
              onSelection()
              setOpen(false)
            }}
          />
        )}
        <DropdownMenuRadioGroup
          value={String(zoom)}
          onValueChange={(value) => {
            const next = zoomOf(value)
            if (next !== null) onZoom(next)
          }}
        >
          <EditorMenuRow
            value="fit"
            label={zoomCopy.fit}
            shortcut={zoomCopy.fitKey}
            keys="Control+0 Meta+0 Shift+1"
            checked={zoom === "fit"}
          />
          {zoomPresets.map((preset) => (
            <EditorMenuRow key={preset} value={String(preset)} label={zoomToOf(preset)} checked={zoom === preset} />
          ))}
        </DropdownMenuRadioGroup>
      </EditorMenuContent>
    </DropdownMenu>
  )
}
