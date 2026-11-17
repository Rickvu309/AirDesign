import { Filmstrip, type TextFormatting } from "@airdesign/render"
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { flushSync } from "react-dom"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { steppedZoom, zoomPercent, type SlideSize } from "@/editor/canvas-zoom"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/use-deck-status"
import { DeckTitle, ExportButton, hairlineShadow, Island, surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { focusMove, gridCommand, type GridCommand } from "@/editor/editor-grid-keys"
import { GridSlideMenu, pointAt, type GridMenu, type MenuAnchor } from "@/editor/grid-menu"
import {
  pickAll,
  pickedSlides,
  pickRange,
  pickToggle,
  prunedPick,
  toggledCurrent,
  type GridPick,
} from "@/editor/grid-selection"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { useGridDrag } from "@/editor/use-grid-drag"
import { gridGap, gridLayout, smallestThumb, useKeptGridZoom, type GridRoom } from "@/editor/grid-zoom"
import type { FormatShown } from "@/editor/format-buttons"
import type { ToolPick } from "@/editor/pointer-tool"
import { gridRows, GridSectionHead } from "@/editor/grid-section"
import { sectionAt, useKeptCollapsed } from "@/editor/collapsed-sections"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { ViewBar } from "@/editor/view-bar"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ExportControl } from "@/export/export-control"
import { PresentButton } from "@/present/present-button"
import type { ExportRequest } from "@/export/export-deck"
import type { TableSize } from "@/element-edit"
import { cn } from "@/lib/class-names"

const thumbFace = cn("block overflow-hidden rounded-[2px] bg-white", hairlineShadow)

const noSections: readonly StripSection[] = []

const listInset = 48

const listPad = 24

const wideSlide: SlideSize = { width: 12_192_000, height: 6_858_000 }

function gridThumbHeight(width: number, height: number): number {
  if (height <= 0) return Math.round((width * 9) / 16)
  return Math.round((height * width) / slideThumbWidth)
}

export function EditorGrid({
  id = null,
  title,
  strip,
  size = null,
  onSlides,
  onRename,
  onExport,
  onPresent,
  presenting = false,
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
  save = null,
}: {
  id?: string | null
  title: string
  strip: SlideStrip
  size?: SlideSize | null
  onSlides: () => void
  onRename?: (name: string) => void
  onExport: (request?: ExportRequest) => Promise<void> | void
  onPresent?: (from: number) => void
  presenting?: boolean
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
}) {
  const list = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [room, setRoom] = useState<GridRoom | null>(null)
  const [zoom, setZoom] = useKeptGridZoom(id)
  const [menu, setMenu] = useState<GridMenu | null>(null)
  const [pick, setPick] = useState<GridPick>(null)
  const { current, count } = strip
  const picked = prunedPick(pick, count)
  const selected = new Set(pickedSlides(picked, current))
  const sections = strip.sections ?? noSections
  const collapsed = useKeptCollapsed(id, sections, current)
  const [seen, setSeen] = useState(current)
  if (seen !== current) {
    setSeen(current)
    collapsed.open(sectionAt(sections, current))
  }
  const shown = (index: number) => !collapsed.held.has(sectionAt(sections, index))
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
    const measure = () => {
      const width = Math.max(0, scroller.clientWidth - 2 * listInset)
      const height = Math.max(0, scroller.clientHeight - 2 * listPad)
      setRoom((last) => (last?.width === width && last.height === height ? last : { width, height }))
    }
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])
  const reachable = stop >= 0 && stop < count && shown(stop) ? stop : current
  const rows = gridRows(strip)
  const slide = size ?? wideSlide
  const shape = {
    counts: rows.map((row) => (row.number !== null && collapsed.held.has(row.number) ? 0 : row.end - row.start)),
    heads: rows.filter((row) => row.name !== null && row.number !== null).length,
    aspect: gridThumbHeight(1000, strip.thumbHeight) / 1000,
  }
  const fit = room === null ? { columns: 0, width: smallestThumb } : gridLayout(zoom, room, slide, shape)
  const width = fit.width
  const height = gridThumbHeight(width, strip.thumbHeight)
  const percent = zoomPercent(width, slide)
  useZoomKeys(!presenting, (key) => setZoom(key === "fit" ? "fit" : steppedZoom(key, percent)))
  const drag = useGridDrag({
    list,
    bar,
    rows,
    onMove: (from, to) => {
      following.current = true
      strip.onMove?.(from, to)
      announce(slideListCopy.moved(from + 1, to + 1))
    },
  })
  const dragging = drag.dragging

  function addAfter(index: number) {
    following.current = true
    strip.onAdd?.(undefined, index)
  }

  function open(index: number) {
    flushSync(() => strip.onSelect(index))
    onSlides()
  }

  function choose(next: GridPick) {
    setPick(next)
    if (next !== null) announce(slideListCopy.selected(next.slides.size))
  }

  function act(command: GridCommand, index: number) {
    const target = picked?.slides.size === 1 ? (pickedSlides(picked, current)[0] ?? index) : index
    if (picked?.slides.size === 1) setPick(null)
    if (command === "open") {
      open(target)
      return
    }
    if (picked !== null && picked.slides.size > 1) {
      announce(slideListCopy.selectOne)
      return
    }
    if (command === "remove") {
      if (count < 2) return
      following.current = true
      strip.onRemove?.(target)
      announce(slideListCopy.deleted(target + 1))
      return
    }
    if (command === "clone") {
      following.current = true
      strip.onClone?.(target)
      announce(slideListCopy.duplicated(target + 1))
      return
    }
    if (command === "earlier" && target > 0) {
      following.current = true
      strip.onMove?.(target, target - 1)
      announce(slideListCopy.moved(target + 1, target))
    }
    if (command === "later" && target < count - 1) {
      following.current = true
      strip.onMove?.(target, target + 1)
      announce(slideListCopy.moved(target + 1, target + 2))
    }
  }

  function openMenu(index: number, anchor: MenuAnchor, pointer: boolean) {
    setPick(null)
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
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault()
      choose(pickAll(count, current))
      return
    }
    if (event.key === "Escape" && picked !== null) {
      event.preventDefault()
      setPick(null)
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
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const slide = focusMove(event.currentTarget, event.key)
    if (slide === null) return
    event.preventDefault()
    if (event.shiftKey) choose(pickRange(picked, slide, current))
    else setPick(null)
    strip.onSelect(slide)
  }

  const card = (index: number) => (
    <div key={index} className="group relative flex flex-col items-start gap-2" style={drag.shift(index)}>
      <button
        type="button"
        draggable
        aria-current={index === current ? "true" : undefined}
        aria-label={
          picked !== null && selected.has(index)
            ? slideListCopy.selectedName(index + 1, count)
            : slideListCopy.slideName(index + 1, count)
        }
        tabIndex={index === reachable ? 0 : -1}
        data-slide-entry={index + 1}
        className={cn(
          "relative rounded-sm text-left",
          selected.has(index) && "shadow-[0_0_0_2px_var(--ring)]",
          index === dragging && "pointer-events-none opacity-40",
        )}
        onClick={(event) => {
          if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
            setPick(null)
            open(index)
            return
          }
          const next = event.shiftKey ? pickRange(picked, index, current) : pickToggle(picked, index, current)
          choose(next)
          strip.onSelect(toggledCurrent(next, index))
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.currentTarget.focus()
          openMenu(index, pointAt(event.clientX, event.clientY), true)
        }}
        onDragStart={(event) => {
          setPick(null)
          drag.start(index, event)
        }}
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
            "invisible relative flex size-4 scale-75 self-center rounded-full p-0 opacity-0 transition-[opacity,scale,visibility] duration-[var(--duration-micro)] ease-[var(--ease-out)] after:absolute after:-inset-1 hover:bg-primary-strong",
            dragging === null && "group-hover:visible group-hover:scale-100 group-hover:opacity-100",
          )}
          onClick={() => addAfter(index)}
        >
          <EditorIcon name="plus" size={10} strokeWidth={3.2} />
        </Button>
      </span>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col" inert={presenting} data-editor-grid>
      <header className="flex h-24 shrink-0 items-start justify-between px-3 pt-3">
        <Island>
          <span className="flex size-8 items-center justify-center">
            <AirdesignMark size={20} />
          </span>
          <DeckTitle title={title} className="pr-2 pl-0.5" {...(onRename === undefined ? {} : { onRename })} />
          {save === null ? null : <SaveStatusLine status={save} />}
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
          {picked === null ? null : (
            <span className="px-2 text-xs font-medium text-foreground tabular-nums" data-grid-selected>
              {slideListCopy.selected(picked.slides.size)}
            </span>
          )}
        </Island>
        <Island>
          <ViewBar zoom={size === null ? null : <ZoomMenu zoom={zoom} percent={percent} onZoom={setZoom} />}>
            <PresentButton {...(onPresent === undefined ? {} : { onClick: () => onPresent(reachable) })} />
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
                  ...(picked === null ? {} : { selected: pickedSlides(picked, current) }),
                }}
              />
            )}
          </ViewBar>
        </Island>
      </header>
      <Announcer message={message} />
      {menu === null ? null : <GridSlideMenu menu={menu} count={count} onAct={act} onClose={closeMenu} />}
      <div
        ref={list}
        role="group"
        aria-label={slideListCopy.listName}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-6"
        style={{ paddingInline: listInset }}
        data-slide-list
        onKeyDown={onListKey}
        onDragOver={drag.over}
        onDrop={drag.drop}
        onDragEnd={drag.end}
        onClick={(event) => {
          if (picked !== null && (event.target as Element).closest("[data-slide-entry]") === null) setPick(null)
        }}
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
              {row.name === null || row.number === null ? null : (
                <GridSectionHead
                  name={row.name}
                  count={row.end - row.start}
                  open={!collapsed.held.has(row.number)}
                  onToggle={() => {
                    if (row.number !== null) collapsed.toggle(row.number)
                  }}
                />
              )}
              {row.number !== null && collapsed.held.has(row.number) ? null : (
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
              )}
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
