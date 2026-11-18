import type { RefObject } from "react"
import { limits } from "@airdesign/document"
import { zoomRanges } from "@/editor/canvas-zoom"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { AirdesignMark } from "@/decks/airdesign-mark"
import type { SlideSize, Zoom } from "@/editor/canvas-zoom"
import { DeckTitle, ExportButton, Island, surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"
import { SaveStatusLine } from "@/editor/save-status"
import type { SlideStrip } from "@/editor/slide-sidebar"
import type { SaveStatus } from "@/editor/use-deck-status"
import { ViewBar } from "@/editor/view-bar"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import { cn } from "@/lib/class-names"
import { PresentButton } from "@/present/present-button"

export function GridHead({
  title,
  strip,
  size,
  zoom,
  percent,
  picked,
  save,
  onZoom,
  canvas,
  onSelection,
  onAdd,
  onSlides,
  onRename,
  onTrash,
  onPresent,
  onExport,
}: {
  title: string
  strip: SlideStrip
  size: SlideSize | null
  zoom: Zoom
  percent: number
  picked: GridPick
  save: SaveStatus | null
  onZoom: (zoom: Zoom) => void
  canvas?: RefObject<HTMLElement | null>
  onSelection: () => void
  onAdd: () => void
  onSlides: () => void
  onRename?: (name: string) => void
  onTrash?: () => void
  onPresent?: () => void
  onExport: (request?: ExportRequest) => Promise<void> | void
}) {
  const full = strip.count >= limits.slides
  return (
    <header className="flex h-24 shrink-0 items-start justify-between px-3 pt-3">
      <Island>
        <span className="flex size-8 items-center justify-center">
          <AirdesignMark size={20} />
        </span>
        <DeckTitle
          title={title}
          className="pr-2 pl-0.5"
          {...(onRename === undefined ? {} : { onRename })}
          {...(onTrash === undefined ? {} : { onTrash })}
        />
        {save === null ? null : <SaveStatusLine status={save} />}
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-7 gap-1 rounded-md bg-white pr-2 pl-1.5 text-xs font-medium text-foreground hover:bg-white active:translate-y-0 aria-disabled:opacity-50",
            surfaceShadow,
          )}
          aria-disabled={full || undefined}
          title={full ? slideListCopy.addLimit(limits.slides) : undefined}
          onClick={() => {
            if (!full) onAdd()
          }}
        >
          <EditorIcon name="plus" size={13} />
          {slideListCopy.newSlide}
        </Button>
        <span className="mx-1 block h-5 w-px bg-[var(--field-edge)]" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-faint hover:bg-transparent active:translate-y-0"
          aria-label="Slides"
          onClick={onSlides}
        >
          <EditorIcon name="slide" size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md bg-line text-foreground hover:bg-line active:translate-y-0"
          aria-label="Grid"
          aria-pressed
          onClick={() => undefined}
        >
          <EditorIcon name="grid" size={16} />
        </Button>
        {picked === null ? null : (
          <span className="px-2 text-xs font-medium text-foreground tabular-nums" data-grid-selected>
            {slideListCopy.selected(picked.slides.size)}
          </span>
        )}
      </Island>
      <Island>
        <ViewBar
          zoom={
            size === null ? null : (
              <ZoomMenu
                range={zoomRanges.grid}
                zoom={zoom}
                percent={Math.round(percent)}
                onZoom={onZoom}
                {...(canvas === undefined ? {} : { canvas })}
                onSelection={onSelection}
              />
            )
          }
        >
          <PresentButton {...(onPresent === undefined ? {} : { onClick: onPresent })} />
          {size === null ? (
            <ExportButton onClick={() => void onExport()} />
          ) : (
            <ExportControl
              target={{
                name: title,
                count: strip.count,
                current: strip.current,
                size,
                slide: strip.thumb,
                onExport,
                ...(picked === null ? {} : { selected: pickedSlides(picked, strip.current) }),
              }}
            />
          )}
        </ViewBar>
      </Island>
    </header>
  )
}
