import { slideListCopy } from "@/copy/slide-list-copy"
import { shortcutCopy } from "@/copy/shortcut-copy"
import { fitZoomOf } from "@/copy/product-copy"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Zoom } from "@/editor/canvas-zoom"
import { steppedZoom, zoomSteps } from "@/editor/canvas-zoom"
import { EditorIcon } from "@/editor/editor-icons"
import { EditorMenuContent, EditorMenuRow } from "@/editor/editor-menu"

function zoomOf(value: unknown): Zoom | null {
  if (value === "fit") return "fit"
  return zoomSteps.find((step) => String(step) === value) ?? null
}

export function ZoomMenu({
  zoom,
  percent,
  fitPercent,
  onZoom,
}: {
  zoom: Zoom
  percent: number
  fitPercent: number
  onZoom: (zoom: Zoom) => void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-0.5 rounded-[var(--shape-control)] border-0 px-0 pr-1 text-[length:var(--type-dense)] font-normal text-quiet hover:bg-transparent hover:text-foreground active:translate-y-0 aria-expanded:bg-transparent aria-expanded:text-foreground"
          />
        }
        aria-label={`${slideListCopy.zoom} ${String(percent)}%`}
        data-zoom-readout
      >
        {`${String(percent)}%`}
        <EditorIcon name="chev" size={12} className="text-faint" />
      </DropdownMenuTrigger>
      <EditorMenuContent side="bottom" align="start" sideOffset={4}>
        <DropdownMenuRadioGroup
          value={String(zoom)}
          onValueChange={(value) => {
            const next = zoomOf(value)
            if (next !== null) onZoom(next)
          }}
        >
          <EditorMenuRow
            value="fit"
            icon="slide"
            label={fitZoomOf(fitPercent)}
            checked={zoom === "fit"}
            shortcut={shortcutCopy("0")}
          />
          {zoomSteps.map((step) => (
            <EditorMenuRow key={step} value={String(step)} label={`${String(step)}%`} checked={zoom === step} />
          ))}
        </DropdownMenuRadioGroup>
        {(["in", "out"] as const).map((direction) => (
          <DropdownMenuItem
            key={direction}
            onClick={() => onZoom(steppedZoom(direction, percent))}
            className="h-8 gap-2.5 rounded-md px-2.5 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white"
          >
            <EditorIcon name={direction === "in" ? "plus" : "minus"} size={16} />
            <span className="flex-1">{direction === "in" ? "Zoom in" : "Zoom out"}</span>
            <span className="text-xs text-[var(--shortcut)]">{shortcutCopy(direction === "in" ? "=" : "-")}</span>
          </DropdownMenuItem>
        ))}
      </EditorMenuContent>
    </DropdownMenu>
  )
}
