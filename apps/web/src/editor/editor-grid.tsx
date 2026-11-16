import { Filmstrip, type TextFormatting } from "@airdesign/render"
import { useCallback, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { slideListCopy } from "@/copy/slide-list-copy"
import { AirdesignMark } from "@/decks/airdesign-mark"
import type { SlideSize } from "@/editor/canvas-zoom"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/use-deck-status"
import { DeckTitle, ExportButton, hairlineShadow, Island, surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { EditorMenuContent } from "@/editor/editor-menu"
import { gridCommand, gridMove, type GridCommand } from "@/editor/editor-grid-keys"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { dropPlace, dropTarget, edgeScroll } from "@/editor/grid-drop"
import { gridFit, gridGap, gridSizes, steppedGridSize, useKeptGridSize } from "@/editor/grid-size"
import type { FormatShown } from "@/editor/format-buttons"
import type { ToolPick } from "@/editor/pointer-tool"
import type { SlideKey } from "@/editor/slide-keys"
import { slideMenuItem, SlideMenuRows } from "@/editor/slide-menu"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import type { TableSize } from "@/element-edit"
import { cn } from "@/lib/class-names"

const thumbFace = cn("block overflow-hidden rounded-[2px] bg-white", hairlineShadow)

const noSections: readonly StripSection[] = []

const listInset = 48

const gridChange: Record<SlideKey, GridCommand> = { clone: "clone", remove: "remove", up: "earlier", down: "later" }

type MenuAnchor = { readonly getBoundingClientRect: () => DOMRect }

type GridMenu = { readonly index: number; readonly anchor: MenuAnchor; readonly pointer: boolean }

function pointAt(x: number, y: number): MenuAnchor {
  return { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }
}

function gridThumbHeight(width: number, height: number): number {
  if (height <= 0) return Math.round((width * 9) / 16)
  return Math.round((height * width) / slideThumbWidth)
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
  id = null,
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
  id?: string | null
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
  const bar = useRef<HTMLDivElement>(null)
  const place = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const following = useRef(true)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [room, setRoom] = useState<number | null>(null)
  const [zoom, setZoom] = useKeptGridSize(id)
  const [menu, setMenu] = useState<GridMenu | null>(null)
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
  useLayoutEffect(() => {
    const scroller = list.current
    if (scroller === null) return
    const measure = () => setRoom(Math.max(0, scroller.clientWidth - 2 * listInset))
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])
  useZoomKeys(true, (key) => setZoom(steppedGridSize(key, zoom)))
  const reachable = stop >= 0 && stop < count ? stop : current
  const fit = room === null ? { columns: 0, width: zoom } : gridFit(room, zoom)
  const width = fit.width
  const height = gridThumbHeight(width, strip.thumbHeight)
  const step = gridSizes.indexOf(zoom)
  const rows = rowsOf(strip)

  function endDrag() {
    place.current = null
    setDragging(null)
    const mark = bar.current
    if (mark !== null) mark.hidden = true
  }

  function showBar(anchor: HTMLElement, x: number, index: number) {
    const mark = bar.current
    const scroller = list.current
    if (mark === null || scroller === null) return
    const listBox = scroller.getBoundingClientRect()
    const at = dropPlace(x, anchor.getBoundingClientRect(), index)
    place.current = at
    const after = at !== index || rows.some((row) => row.start === at && at > 0)
    const card = !after || at - 1 === index ? anchor : scroller.querySelector<HTMLElement>(`[data-slide-entry="${at}"]`)
    if (card === null) return
    const box = card.getBoundingClientRect()
    const left = after ? box.right + gridGap / 2 : box.left - gridGap / 2
    mark.hidden = false
    mark.dataset.dropPlace = String(at + 1)
    mark.style.height = `${box.height}px`
    mark.style.transform = `translate(${left - listBox.left + scroller.scrollLeft - 2}px, ${box.top - listBox.top + scroller.scrollTop}px)`
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

  function openMenu(index: number, anchor: MenuAnchor, pointer: boolean) {
    setStop(index)
    strip.onSelect(index)
    setMenu({ index, anchor, pointer })
  }

  function closeMenu() {
    const shown = menu
    setMenu(null)
    if (shown === null) return
    list.current?.querySelector<HTMLElement>(`[data-slide-entry="${shown.index + 1}"]`)?.focus()
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      const card = document.activeElement?.closest<HTMLElement>("[data-slide-entry]")
      if (card === null || card === undefined) return
      event.preventDefault()
      openMenu(Number(card.dataset.slideEntry) - 1, card, false)
      return
    }
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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData("text/plain"))
    const at = place.current
    endDrag()
    if (!Number.isInteger(from) || at === null) return
    const to = dropTarget(from, at)
    if (to === null) return
    following.current = true
    strip.onMove?.(from, to)
    announce(slideListCopy.moved(from + 1, to + 1))
  }

  function onListDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const scroller = event.currentTarget
    const box = scroller.getBoundingClientRect()
    const step = edgeScroll(event.clientY, { top: box.top, height: box.height })
    if (step !== 0) scroller.scrollTop += step
  }

  const card = (index: number) => (
    <div key={index} className="group relative flex flex-col items-start gap-2">
      <button
        type="button"
        draggable
        aria-current={index === current ? "true" : undefined}
        aria-label={slideListCopy.slideName(index + 1, count)}
        tabIndex={index === reachable ? 0 : -1}
        data-slide-entry={index + 1}
        className={cn(
          "relative rounded-sm text-left",
          index === current && "shadow-[0_0_0_2px_var(--ring)]",
          index === dragging && "opacity-40",
        )}
        onClick={() => {
          strip.onSelect(index)
          onSlides()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.currentTarget.focus()
          openMenu(index, pointAt(event.clientX, event.clientY), true)
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(index))
          event.dataTransfer.effectAllowed = "move"
          setDragging(index)
        }}
        onDragOver={(event) => showBar(event.currentTarget, event.clientX, index)}
      >
        <Filmstrip className={thumbFace} height={height} paint={() => strip.thumb(index, width)} width={width} />
      </button>
      <span
        aria-hidden="true"
        data-slide-number
        className={cn(
          "h-4 text-[length:var(--type-caption)] leading-4 tabular-nums",
          index === current ? "font-semibold text-primary-strong" : "text-quiet",
        )}
      >
        {index + 1}
      </span>
      <span className="absolute top-0 -right-8 flex w-8 justify-center" style={{ height }}>
        <Button
          type="button"
          variant="default"
          tabIndex={-1}
          aria-label={slideListCopy.addAfter(index + 1)}
          className={cn(
            "hidden size-4 self-center rounded-full p-0 hover:bg-primary-strong",
            dragging === null && "group-hover:flex",
          )}
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
          <span className="flex w-36 items-center gap-2 px-2 text-quiet" data-grid-zoom>
            <EditorIcon name="grid" size={12} />
            <Slider
              label={slideListCopy.zoom}
              valueText={() => slideListCopy.perRow(fit.columns)}
              min={0}
              max={gridSizes.length - 1}
              step={1}
              value={step}
              onValueChange={(value) => {
                const next = gridSizes[value]
                if (next !== undefined) setZoom(next)
              }}
            />
            <EditorIcon name="slide" size={15} />
          </span>
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
      {menu === null ? null : (
        <DropdownMenu
          open
          onOpenChange={(next) => {
            if (!next) closeMenu()
          }}
        >
          <EditorMenuContent
            anchor={menu.anchor}
            side={menu.pointer ? "bottom" : "right"}
            align="start"
            sideOffset={menu.pointer ? 2 : 8}
          >
            <DropdownMenuItem
              aria-keyshortcuts="Enter"
              className={slideMenuItem}
              onClick={() => act("open", menu.index)}
            >
              <span className="min-w-0 flex-1">{slideListCopy.open}</span>
              <span className="text-xs text-[var(--shortcut)]">{slideListCopy.openKey}</span>
            </DropdownMenuItem>
            <SlideMenuRows
              index={menu.index}
              count={count}
              onChoose={(change) => act(gridChange[change], menu.index)}
            />
          </EditorMenuContent>
        </DropdownMenu>
      )}
      <div
        ref={list}
        role="group"
        aria-label={slideListCopy.listName}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-6"
        style={{ paddingInline: listInset }}
        data-slide-list
        onKeyDown={onListKey}
        onDragOver={onListDragOver}
        onDrop={onDrop}
        onDragEnd={endDrag}
        onFocus={(event) => {
          const entry = event.target.closest("[data-slide-entry]")?.getAttribute("data-slide-entry")
          if (entry !== null && entry !== undefined) setStop(Number(entry) - 1)
        }}
      >
        <div
          ref={bar}
          hidden
          data-drop-bar
          className="pointer-events-none absolute top-0 left-0 z-10 w-1 rounded-full bg-primary"
        />
        <div className="flex w-full flex-col gap-8">
          {rows.map((row) => (
            <section key={`${row.start}:${row.name ?? ""}`} className="flex flex-col gap-4">
              {row.name === null ? null : (
                <div className="flex h-5 items-center gap-2">
                  <h2 className="text-[length:var(--type-caption)] font-semibold text-foreground">{row.name}</h2>
                  <span className="text-[length:var(--type-caption)] text-quiet tabular-nums">
                    {slideListCopy.sectionCount(row.end - row.start)}
                  </span>
                  <span className="ml-1 block h-px flex-1 bg-line" />
                </div>
              )}
              <div
                className="grid gap-y-6"
                style={{
                  columnGap: gridGap,
                  gridTemplateColumns:
                    fit.columns === 0
                      ? `repeat(auto-fill, ${String(width)}px)`
                      : `repeat(${String(fit.columns)}, ${String(width)}px)`,
                }}
              >
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
