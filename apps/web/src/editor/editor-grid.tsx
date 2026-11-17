import { type TextFormatting } from "@airdesign/render"
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { steppedZoom, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { GridCard } from "@/editor/grid-card"
import { gridLayout, gridGap, useKeptGridZoom } from "@/editor/grid-zoom"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ViewBar } from "@/editor/view-bar"
import { PresentButton } from "@/present/present-button"
import { useGridViewport } from "@/editor/use-grid-viewport"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/use-deck-status"
import { DeckTitle, ExportButton, Island, surfaceShadow } from "@/editor/editor-chrome"
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
import type { FormatShown } from "@/editor/format-buttons"
import type { ToolPick } from "@/editor/pointer-tool"
import { gridRows, GridSectionHead } from "@/editor/grid-section"
import { sectionAt, useKeptCollapsed } from "@/editor/collapsed-sections"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import type { TableSize } from "@/element-edit"
import { cn } from "@/lib/class-names"

const noSections: readonly StripSection[] = []

const wideSlide = { width: 12_192_000, height: 6_858_000 }

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
  onTrash,
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
  slide,
}: {
  id?: string | null
  title: string
  strip: SlideStrip
  size?: SlideSize | null
  onSlides: () => void
  onTrash?: () => void
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
  slide?: (width: number) => ReactNode
}) {
  const list = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [zoom, setZoom] = useKeptGridZoom(id)
  const [fitPercent, setFitPercent] = useState(25)
  const percent = zoom === "fit" ? fitPercent : zoom
  const fit = gridLayout(100, size ?? wideSlide, strip.count)
  const width = fit.width
  const viewport = useGridViewport({
    world: list,
    scale: percent / 100,
    hand: pointer?.tool === "hand",
    onZoom: setZoom,
    onFit: setFitPercent,
    selected: strip.current,
    initialFit: zoom === "fit",
    fitting: zoom === "fit",
    layout: `${strip.count}:${strip.sections?.map((section) => section.start).join(",") ?? ""}`,
  })
  function chooseZoom(next: Zoom) {
    setZoom(next)
    if (next === "fit") viewport.reset()
  }
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
    if (next !== null && next !== undefined && next !== document.activeElement) next.focus({ preventScroll: true })
  }, [current, count])
  useZoomKeys(!presenting, (key) => chooseZoom(key === "fit" ? "fit" : steppedZoom(key, percent)))
  const reachable = stop >= 0 && stop < count && shown(stop) ? stop : current
  const layoutWidth = fit.columns * width + (fit.columns - 1) * gridGap
  const height = gridThumbHeight(width, strip.thumbHeight)
  const rows = gridRows(strip)
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
    flushSync(() => {
      strip.onSelect(index)
      setEditing(true)
    })
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
    if (event.target instanceof Element && event.target.closest("[data-grid-edit]") !== null) return
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
    <GridCard
      key={index}
      index={index}
      count={count}
      current={index === current}
      selected={selected.has(index)}
      multiple={picked !== null}
      reachable={index === reachable}
      dragging={index === dragging}
      busy={dragging !== null}
      active={editing && index === current && slide !== undefined}
      scale={percent / 100}
      width={width}
      height={height}
      shift={drag.shift(index)}
      thumb={(width) => strip.thumb(index, width)}
      slide={slide}
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
      onAdd={() => addAfter(index)}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col" inert={presenting} data-editor-grid>
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
          <ViewBar
            zoom={size === null ? null : <ZoomMenu zoom={zoom} percent={Math.round(percent)} onZoom={chooseZoom} />}
          >
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
        {...viewport.handlers}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden touch-none",
          pointer?.tool === "hand" && "cursor-grab active:cursor-grabbing",
        )}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-grid-card]") === null) {
            setPick(null)
            setEditing(false)
          }
        }}
        data-grid-viewport
        data-slide-list
      >
        <div
          ref={list}
          role="group"
          aria-label={slideListCopy.listName}
          className="absolute top-0 left-0"
          style={{ width: layoutWidth, transformOrigin: "0 0" }}
          onKeyDown={onListKey}
          onDragOver={drag.over}
          onDrop={drag.drop}
          onDragEnd={drag.end}
          onFocus={(event) => {
            const entry = event.target.closest("[data-slide-entry]")?.getAttribute("data-slide-entry")
            if (entry !== null && entry !== undefined) setStop(Number(entry) - 1)
          }}
        >
          <div
            ref={bar}
            hidden
            data-drop-bar
            className="pointer-events-none absolute top-0 left-0 z-10 rounded-full bg-primary"
            style={{ width: 4 / (percent / 100), borderRadius: 2 / (percent / 100) }}
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
                    className="grid gap-y-48"
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
      </div>
      <div className="flex shrink-0 justify-center pb-6">
        <EditorToolbar
          activeTool={activeTool}
          menuOpen={toolMenu}
          panel={panel}
          undo={undo}
          {...(pointer === undefined ? {} : { pointer })}
          {...(onText === undefined
            ? {}
            : {
                onText: () => {
                  setEditing(true)
                  onText()
                },
              })}
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
