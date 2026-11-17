import { noSelection, type Selection } from "@airdesign/render"
import { limits } from "@airdesign/document"
import { useCallback, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { slideListCopy } from "@/copy/slide-list-copy"
import { steppedZoom, zoomRanges, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { EditorToolbar } from "@/editor/editor-toolbar"
import { cardPress } from "@/editor/grid-hit"
import { GridCard } from "@/editor/grid-card"
import { GridHead } from "@/editor/grid-head"
import { GridRowAdd } from "@/editor/grid-row-add"
import { gridSpacing } from "@/editor/grid-viewport"
import { GridDragGhost } from "@/editor/grid-drag-ghost"
import { dragMoves, landing } from "@/editor/grid-drop"
import { gridLayout, keptGridViewport, useKeptGridZoom } from "@/editor/grid-zoom"
import { gridOpened, gridPick, gridRinged, gridStep } from "@/editor/grid-interaction"
import { useGridViewport } from "@/editor/use-grid-viewport"
import { useGridEditing } from "@/editor/use-grid-editing"
import type { SaveStatus } from "@/editor/use-deck-status"
import { focusMove, gridCommand, type GridCommand } from "@/editor/editor-grid-keys"
import { GridSlideMenu, pointAt, type GridMenu, type MenuAnchor } from "@/editor/grid-menu"
import { pickAll, pickedSlides, pickRange, prunedPick } from "@/editor/grid-selection"
import { useGridDrag } from "@/editor/use-grid-drag"
import type { ToolPick } from "@/editor/pointer-tool"
import { gridRows, GridSectionHead } from "@/editor/grid-section"
import { sectionAt, useKeptCollapsed } from "@/editor/collapsed-sections"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import { insertsFirst, type ToolbarTools } from "@/editor/toolbar-tools"
import { useZoomKeys } from "@/editor/zoom-keys"
import type { ExportRequest } from "@/export/export-deck"
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
  pointer,
  tools = {},
  selection = noSelection,
  select = () => undefined,
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
  pointer?: ToolPick
  tools?: ToolbarTools
  selection?: Selection
  select?: (selection: Selection) => void
  save?: SaveStatus | null
  slide?: (width: number) => ReactNode
}) {
  const list = useRef<HTMLDivElement>(null)
  const [state, dispatch] = useReducer(gridStep, selection.ids.length > 0, gridOpened)
  const bar = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const following = useRef(keptGridViewport(id) === null)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [zoom, setZoom] = useKeptGridZoom(id)
  const [fitPercent, setFitPercent] = useState(25)
  const percent = zoom === "fit" ? fitPercent : zoom
  const fit = gridLayout(100, size ?? wideSlide, strip.count)
  const width = fit.width
  const viewport = useGridViewport({
    deck: id,
    world: list,
    scale: percent / 100,
    hand: pointer?.tool === "hand",
    working: !presenting,
    onZoom: setZoom,
    onFit: setFitPercent,
    selected: strip.current,
    initialFit: zoom === "fit",
    fitting: zoom === "fit",
    layout: `${strip.count}:${strip.gridStarts?.join(",") ?? ""}:${strip.sections?.map((section) => section.start).join(",") ?? ""}`,
  })
  function chooseZoom(next: Zoom) {
    setZoom(next)
    if (next === "fit") viewport.reset()
  }
  const [elementPressed, setElementPressed] = useState(false)
  const [menu, setMenu] = useState<GridMenu | null>(null)
  const { current, count } = strip
  const picked = prunedPick(gridPick(state), count)
  const selected = new Set(gridRinged(state, current, count))
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
  const edit = useGridEditing({ world: list, state, dispatch, current, select, onSelect: strip.onSelect, announce })
  useSlideSay(strip.say, announce)
  useLayoutEffect(() => {
    if (!following.current) return
    const next = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${current + 1}"]`)
    following.current = false
    setStop(current)
    if (next !== null && next !== undefined && next !== document.activeElement) next.focus({ preventScroll: true })
  }, [current, count])
  useZoomKeys(!presenting, (key) => {
    if (key === "selection")
      viewport.selection(state.kind === "elements" || state.kind === "text" ? [current] : [...selected])
    else chooseZoom(key === "fit" ? "fit" : steppedZoom(key, percent, zoomRanges.grid))
  })
  const reachable = stop >= 0 && stop < count && shown(stop) ? stop : current
  const height = gridThumbHeight(width, strip.thumbHeight)
  const spacing = gridSpacing(width, height)
  const rows = gridRows(strip)
  const columns = Math.max(1, ...rows.map((row) => row.end - row.start))
  const layoutWidth = columns * width + (columns - 1) * spacing.column
  const drag = useGridDrag({
    list,
    bar,
    ghost,
    viewport: viewport.handlers.ref,
    rows,
    selected: pickedSlides(picked, current),
    panBy: viewport.panBy,
    onPanEnd: viewport.panEnd,
    onPick: (index, shift, toggle) => {
      flushSync(() => edit.pick(index, shift, toggle, picked))
      list.current
        ?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
        ?.focus({ preventScroll: true })
    },
    onMove: (held, at) => {
      const moves = dragMoves(held, at, count)
      if (moves.length === 0) return
      const first = landing(held, at)
      following.current = true
      for (const { from, to } of moves) strip.onMove?.(from, to)
      if (held.length === 1) {
        edit.step({ kind: "pick", pick: null })
        announce(slideListCopy.moved((held[0] ?? first) + 1, first + 1))
        return
      }
      edit.step({ kind: "pick", pick: { anchor: first, slides: new Set(held.map((_, offset) => first + offset)) } })
      announce(slideListCopy.movedSeveral(held.length, first + 1))
    },
  })
  const dragging = drag.dragging

  function addAfter(index: number, keep = false) {
    following.current = true
    if (keep) {
      edit.step({ kind: "pick", pick: null })
      if (zoom === "fit") setZoom(percent)
    }
    strip.onAdd?.(undefined, index)
  }

  function addBelow(index: number) {
    following.current = true
    edit.step({ kind: "pick", pick: null })
    if (zoom === "fit") setZoom(percent)
    strip.onAdd?.(undefined, index, "new")
  }

  function act(command: GridCommand, index: number) {
    const target = picked?.slides.size === 1 ? (pickedSlides(picked, current)[0] ?? index) : index
    if (picked?.slides.size === 1) edit.step({ kind: "pick", pick: null })
    if (command === "open") {
      edit.open(target)
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
    edit.step({ kind: "pick", pick: null })
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

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("[data-add-row], [data-add-gap]") !== null) return
    if (menu !== null && event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
      return
    }
    edit.key(event)
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("[data-grid-edit], [data-add-gap]") !== null) return
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      const card = document.activeElement?.closest<HTMLElement>("[data-slide-entry]")
      if (card === null || card === undefined) return
      event.preventDefault()
      openMenu(Number(card.dataset.slideEntry) - 1, card, false)
      return
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault()
      const all = pickAll(count, current)
      edit.step({ kind: "pick", pick: all })
      if (all !== null) announce(slideListCopy.selected(all.slides.size))
      return
    }
    const command = gridCommand({
      key: event.key,
      code: event.code,
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
    if (event.shiftKey) {
      const next = pickRange(picked, slide, current)
      edit.step({ kind: "pick", pick: next })
      if (next !== null) announce(slideListCopy.selected(next.slides.size))
    } else edit.step({ kind: "pick", pick: null })
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
      dragging={drag.held.includes(index)}
      busy={dragging !== null}
      active={edit.editing && index === current && slide !== undefined}
      scale={percent / 100}
      width={width}
      height={height}
      shift={drag.shift(index)}
      thumb={(width) => strip.thumb(index, width)}
      slide={slide}
      onPress={(event) => {
        drag.grab(index, event)
        edit.press(index, event)
      }}
      onPressed={(event) => edit.click(index, picked, event)}
      onClick={(event) => edit.pick(index, event.shiftKey, event.metaKey || event.ctrlKey, picked)}
      onContextMenu={(event) => {
        event.preventDefault()
        event.currentTarget.focus()
        openMenu(index, pointAt(event.clientX, event.clientY), true)
      }}
      rowEnd={rows.some((row) => row.end === index + 1)}
      addBlocked={viewport.space || pointer?.tool === "hand" || dragging !== null || elementPressed || edit.editing}
      addDisabled={strip.onAdd === undefined || count >= limits.slides}
      onAdd={() => addAfter(index, true)}
    />
  )

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      inert={presenting}
      data-editor-grid
      data-keeps-selection
      onPointerDownCapture={(event) => {
        const pressed = cardPress(event)
        if (event.button === 0 && (pressed === "element" || pressed === "editor")) setElementPressed(true)
      }}
      onPointerUpCapture={() => setElementPressed(false)}
      onPointerCancelCapture={() => setElementPressed(false)}
      onLostPointerCapture={() => setElementPressed(false)}
      onKeyDownCapture={onGridKey}
      onFocusCapture={edit.focus}
      onDoubleClickCapture={edit.double}
    >
      <GridHead
        title={title}
        strip={strip}
        size={size}
        zoom={zoom}
        percent={percent}
        picked={picked}
        save={save}
        onZoom={chooseZoom}
        onSelection={() =>
          viewport.selection(state.kind === "elements" || state.kind === "text" ? [current] : [...selected])
        }
        onAdd={() => addAfter(reachable)}
        onSlides={onSlides}
        onExport={onExport}
        {...(onRename === undefined ? {} : { onRename })}
        {...(onTrash === undefined ? {} : { onTrash })}
        {...(onPresent === undefined ? {} : { onPresent: () => onPresent(reachable) })}
      />
      <Announcer message={message} />
      {dragging === null ? null : (
        <GridDragGhost
          ref={ghost}
          count={drag.held.length}
          width={width}
          height={height}
          thumb={(size) => strip.thumb(dragging, size)}
        />
      )}
      {menu === null ? null : <GridSlideMenu menu={menu} count={count} onAct={act} onClose={closeMenu} />}
      <div
        {...viewport.handlers}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden touch-none after:pointer-events-none after:absolute after:inset-0 after:content-['']",
          "has-[>[data-focus-edge]:focus-visible]:after:shadow-[inset_0_0_0_var(--focus-ring-width)_var(--focus-ring)]",
          (pointer?.tool === "hand" || viewport.space) && "cursor-grab active:cursor-grabbing [&_*]:cursor-[inherit]",
        )}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-grid-card]") === null) edit.clear()
        }}
        data-hover-disabled={
          viewport.space || pointer?.tool === "hand" || dragging !== null || elementPressed ? "true" : undefined
        }
        data-grid-viewport
        data-slide-list
      >
        <div
          ref={list}
          tabIndex={-1}
          role="group"
          aria-label={slideListCopy.listName}
          className="absolute top-0 left-0 outline-none"
          data-focus-edge
          style={{ width: layoutWidth, transformOrigin: "0 0" }}
          onKeyDown={onListKey}
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
          <div className="flex w-full flex-col" style={{ gap: spacing.row }}>
            {rows.map((row, number) => (
              <div key={row.start} data-grid-row-frame>
                <section
                  data-grid-row={row.start}
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${row.end - row.start}, ${width}px)`,
                    columnGap: spacing.column,
                    rowGap: 24 / (percent / 100),
                  }}
                >
                  {Array.from({ length: row.end - row.start }, (_, offset) => {
                    const index = row.start + offset
                    const section = sections.find((section) => section.start === index)
                    const number = sectionAt(sections, index)
                    const marked = sections.some((section) => section.start >= row.start && section.start < row.end)
                    return (
                      <div key={index} className="contents">
                        {marked ? (
                          <div
                            style={{
                              gridColumn: `${offset + 1} / span ${section === undefined ? 1 : Math.min((sections[number + 1]?.start ?? row.end) - index, row.end - index)}`,
                              gridRow: 1,
                            }}
                          >
                            <div style={{ zoom: 1 / (percent / 100) }}>
                              {section === undefined ? null : (
                                <GridSectionHead
                                  marker
                                  name={section.name}
                                  count={(sections[number + 1]?.start ?? count) - section.start}
                                  open={!collapsed.held.has(number)}
                                  onToggle={() => collapsed.toggle(number)}
                                />
                              )}
                            </div>
                          </div>
                        ) : null}
                        <div
                          style={{
                            gridColumn: offset + 1,
                            gridRow: marked ? 2 : 1,
                            visibility: shown(index) ? "visible" : "hidden",
                          }}
                          aria-hidden={!shown(index)}
                        >
                          {shown(index) ? card(index) : <div style={{ height: height + 24 }} />}
                        </div>
                      </div>
                    )
                  })}
                </section>
                <GridRowAdd
                  row={number + 1}
                  width={width}
                  height={height}
                  gap={spacing.row}
                  scale={percent / 100}
                  blocked={viewport.space || pointer?.tool === "hand" || dragging !== null || elementPressed}
                  disabled={strip.onAdd === undefined || count >= limits.slides}
                  onAdd={() => addBelow(row.start)}
                  onEscape={() =>
                    list.current
                      ?.querySelector<HTMLElement>(`[data-slide-entry="${row.start + 1}"]`)
                      ?.focus({ preventScroll: true })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 justify-center pb-6">
        <EditorToolbar {...insertsFirst(tools, edit.activate)} />
      </div>
    </div>
  )
}
