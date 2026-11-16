import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Zoom } from "@/editor/canvas-zoom"
import { zoomSteps } from "@/editor/canvas-zoom"
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
          <EditorMenuRow value="fit" icon="slide" label={`Fit (${String(fitPercent)}%)`} checked={zoom === "fit"} />
          {zoomSteps.map((step) => (
            <EditorMenuRow key={step} value={String(step)} label={`${String(step)}%`} checked={zoom === step} />
          ))}
        </DropdownMenuRadioGroup>
      </EditorMenuContent>
    </DropdownMenu>
  )
}
