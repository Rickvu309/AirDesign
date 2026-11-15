import { Filmstrip, type TextFormatting } from "@airdesign/render"
import { useCallback, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { zoomPercent, type SlideSize } from "@/editor/canvas-zoom"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/use-deck-status"
import { DeckTitle, ExportButton, hairlineShadow, Island, surfaceShadow, ZoomReadout } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { gridCommand, gridMove, type GridCommand } from "@/editor/editor-grid-keys"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import type { FormatShown } from "@/editor/format-buttons"
import type { ToolPick } from "@/editor/pointer-tool"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import type { TableSize } from "@/element-edit"
import { cn } from "@/lib/class-names"

const gridThumbWidth = 300

const thumbFace = cn("block overflow-hidden rounded-[2px] bg-white", hairlineShadow)

const noSections: readonly StripSection[] = []

function gridThumbHeight(height: number): number {
  if (height <= 0) return Math.round((gridThumbWidth * 9) / 16)
  return Math.round((height * gridThumbWidth) / slideThumbWidth)
}

function rowsOf(strip: SlideStrip): { readonly name: string | null; readonly start: number; readonly end: number }[] {
  const sections = strip.sections ?? noSections
  if (sections.length === 0) return [{ name: null, start: 0, end: strip.count }]
  const rows: { name: string | null; start: number; end: number }[] = sections.map((section, index) => ({
    name: section.name,
    start: section.start,
    end: sections[index + 1]?.start ?? strip.count,
  }))
  const first = sections[0]
  if (first !== undefined && first.start > 0) rows.unshift({ name: null, start: 0, end: first.start })
  return rows
}

export function EditorGrid({
  title,
  strip,
  size = null,
  onSlides,
  onRename,
  onExport,
  undo,
  pointer,
  panel = "none",
  onPanel,
  activeTool = "move",
  toolMenu = false,
  onText,
  formatting,
  formats,
  onTable,
  onPicture,
  faded = false,
  save = null,
}: {
  title: string
  strip: SlideStrip
  size?: SlideSize | null
  onSlides: () => void
  onRename?: (name: string) => void
  onExport: (request?: ExportRequest) => Promise<void> | void
  undo: UndoButtonsState
  pointer?: ToolPick
  panel?: EditorPanel
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  activeTool?: EditorTool
  toolMenu?: boolean
  onText?: () => void
  formatting?: TextFormatting
  formats?: FormatShown
  onTable?: (size: TableSize) => void
  onPicture?: (file: File) => void
  save?: SaveStatus | null
  faded?: boolean
}) {
  const list = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const { current, count } = strip
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  useSlideSay(strip.say, announce)
  useLayoutEffect(() => {
    if (!following.current) return
    const next = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${current + 1}"]`)
    following.current = false
    setStop(current)
    if (next !== null && next !== undefined && next !== document.activeElement) next.focus()
  }, [current, count])
  const reachable = stop >= 0 && stop < count ? stop : current
  const height = gridThumbHeight(strip.thumbHeight)
  const percent = size === null || size.width <= 0 ? null : zoomPercent(gridThumbWidth, size)

  function hideGhost() {
    const mark = ghost.current
    if (mark === null) return
    mark.hidden = true
  }

  function showGhost(anchor: HTMLElement) {
    const mark = ghost.current
    const scroller = list.current
    if (mark === null || scroller === null) return
    const listBox = scroller.getBoundingClientRect()
    const box = anchor.getBoundingClientRect()
    mark.hidden = false
    mark.style.width = `${box.width}px`
    mark.style.height = `${box.height}px`
    mark.style.transform = `translate(${box.left - listBox.left + scroller.scrollLeft}px, ${box.top - listBox.top + scroller.scrollTop}px)`
  }

  function addAfter(index: number) {
    following.current = true
    strip.onAdd?.(undefined, index)
    announce(slideListCopy.added(index + 2))
  }

  function act(command: GridCommand, index: number) {
    if (command === "open") {
      strip.onSelect(index)
      onSlides()
      return
    }
    if (command === "remove") {
      if (count < 2) return
      following.current = true
      strip.onRemove?.(index)
      announce(slideListCopy.deleted(index + 1))
      return
    }
    if (command === "clone") {
      following.current = true
      strip.onClone?.(index)
      announce(slideListCopy.duplicated(index + 1))
      return
    }
    if (command === "earlier" && index > 0) {
      following.current = true
      strip.onMove?.(index, index - 1)
      announce(slideListCopy.moved(index + 1, index))
    }
    if (command === "later" && index < count - 1) {
      following.current = true
      strip.onMove?.(index, index + 1)
      announce(slideListCopy.moved(index + 1, index + 2))
    }
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    const command = gridCommand({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    })
    if (command !== null) {
      const entry = document.activeElement?.closest("[data-slide-entry]")?.getAttribute("data-slide-entry")
      if (entry === null || entry === undefined) return
      event.preventDefault()
      act(command, Number(entry) - 1)
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-slide-entry]")]
    const at = buttons.findIndex((button) => button === document.activeElement)
    if (at === -1) return
    event.preventDefault()
    const boxes = buttons.map((button) => {
      const rect = button.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    const next = gridMove(event.key, boxes, at)
    buttons[next]?.focus()
    strip.onSelect(next)
  }

  function onDrop(event: DragEvent<HTMLButtonElement>, index: number) {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData("text/plain"))
    hideGhost()
    if (!Number.isInteger(from) || from === index) return
    following.current = true
    strip.onMove?.(from, index)
    announce(slideListCopy.moved(from + 1, index + 1))
  }

  const card = (index: number) => (
    <div key={index} className="group flex items-center pb-8">
      <button
        type="button"
        draggable
        aria-current={index === current ? "true" : undefined}
        aria-label={slideListCopy.slideName(index + 1, count)}
        tabIndex={index === reachable ? 0 : -1}
        data-slide-entry={index + 1}
        className={cn("relative rounded-sm text-left", index === current && "shadow-[0_0_0_2px_var(--ring)]")}
        onClick={() => {
          strip.onSelect(index)
          onSlides()
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(index))
          event.dataTransfer.effectAllowed = "move"
        }}
        onDragOver={(event) => {
          event.preventDefault()
          showGhost(event.currentTarget)
        }}
        onDrop={(event) => onDrop(event, index)}
      >
        <Filmstrip
          className={thumbFace}
          height={height}
          paint={() => strip.thumb(index, gridThumbWidth)}
          width={gridThumbWidth}
        />
        <span
          className={cn(
            "pointer-events-none absolute top-1.5 left-2 text-[length:var(--type-caption)]",
            index === current ? "font-semibold text-primary-strong" : "text-faint",
          )}
        >
          {index + 1}
        </span>
      </button>
      <span className="flex w-8 shrink-0 justify-center">
        <Button
          type="button"
          variant="default"
          tabIndex={-1}
          aria-label={slideListCopy.addAfter(index + 1)}
          className="hidden size-4 rounded-full p-0 hover:bg-primary-strong group-hover:flex"
          onClick={() => addAfter(index)}
        >
          <EditorIcon name="plus" size={10} strokeWidth={3.2} />
        </Button>
      </span>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-editor-grid>
      <header className="flex h-24 shrink-0 items-start justify-between px-3 pt-3">
        <Island>
          <span className="flex size-8 items-center justify-center">
            <AirdesignMark size={20} />
          </span>
          <DeckTitle title={title} className="pr-2 pl-0.5" {...(onRename === undefined ? {} : { onRename })} />
          {save === null ? null : <SaveStatusLine status={save} className="pr-2" />}
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-7 gap-1 rounded-md bg-white pr-2 pl-1.5 text-xs font-medium text-foreground hover:bg-white active:translate-y-0",
              surfaceShadow,
            )}
            onClick={() => addAfter(reachable)}
          >
            <EditorIcon name="plus" size={13} />
            New slide
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
        </Island>
        <Island>
          {percent === null ? null : <ZoomReadout value={`${String(percent)}%`} tone="ink" />}
          {size === null ? (
            <ExportButton faded={faded} onClick={() => void onExport()} />
          ) : (
            <ExportControl
              faded={faded}
              target={{
                count: strip.count,
                current: strip.current,
                size,
                slide: strip.thumb,
                onExport,
              }}
            />
          )}
        </Island>
      </header>
      <Announcer message={message} />
      <div
        ref={list}
        role="group"
        aria-label={slideListCopy.listName}
        className="relative min-h-0 flex-1 overflow-auto px-12 py-6"
        data-slide-list
        onKeyDown={onListKey}
        onDragEnd={hideGhost}
        onFocus={(event) => {
          const entry = event.target.closest("[data-slide-entry]")?.getAttribute("data-slide-entry")
          if (entry !== null && entry !== undefined) setStop(Number(entry) - 1)
        }}
      >
        <div
          ref={ghost}
          hidden
          data-drop-ghost
          className="pointer-events-none absolute top-0 left-0 rounded-sm border-2 border-dashed border-[var(--placeholder)]"
        />
        <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-8">
          {rowsOf(strip).map((row) => (
            <section key={`${row.start}:${row.name ?? ""}`} className="flex flex-col gap-4">
              {row.name === null ? null : (
                <div className="flex h-5 items-center gap-3">
                  <h2 className="text-[length:var(--type-caption)] font-semibold text-foreground">{row.name}</h2>
                  <span className="block h-px flex-1 bg-line" />
                </div>
              )}
              <div className="flex flex-wrap">
                {Array.from({ length: row.end - row.start }, (_, offset) => card(row.start + offset))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 justify-center pb-6">
        <EditorToolbar
          activeTool={activeTool}
          menuOpen={toolMenu}
          panel={panel}
          undo={undo}
          {...(pointer === undefined ? {} : { pointer })}
          {...(onText === undefined ? {} : { onText })}
          {...(formatting === undefined ? {} : { formatting })}
          {...(formats === undefined ? {} : { formats })}
          {...(onTable === undefined ? {} : { onTable })}
          {...(onPicture === undefined ? {} : { onPicture })}
          {...(onPanel === undefined ? {} : { onPanel })}
        />
      </div>
    </div>
  )
}
