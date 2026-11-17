import { editorOwnsKey } from "@/editor/editor-key-ownership"
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
import { GridRowFrame, moveGridRow, gridMoveMessage, useGridRowFocus } from "@/editor/grid-row-frame"
import { gridAddFits } from "@/editor/grid-add-placement"
import { GridRowAdd } from "@/editor/grid-row-add"
import { gridSpacing, gridThumbHeight } from "@/editor/grid-viewport"
import { GridDragGhost } from "@/editor/grid-drag-ghost"
import { dragMoves, landing } from "@/editor/grid-drop"
import { gridLayout, keptGridViewport, useKeptGridZoom } from "@/editor/grid-zoom"
import { gridOpened, gridPick, gridRinged, gridStep } from "@/editor/grid-interaction"
import { GridThumbnail, useGridViewport } from "@/editor/use-grid-viewport"
import { useGridEditing } from "@/editor/use-grid-editing"
import type { SaveStatus } from "@/editor/use-deck-status"
import { focusMove, gridCommand } from "@/editor/editor-grid-keys"
import { gridSlideActions } from "@/editor/grid-slide-actions"
import { GridSlideMenu, pointAt, type GridMenu, type MenuAnchor } from "@/editor/grid-menu"
import { pickAll, pickedSlides, pickRange, prunedPick } from "@/editor/grid-selection"
import { useGridDrag } from "@/editor/use-grid-drag"
import { useGridSelection } from "@/editor/use-grid-selection"
import type { ToolPick } from "@/editor/pointer-tool"
import { gridRows, GridSectionCell } from "@/editor/grid-section"
import { sectionAt, useKeptCollapsed } from "@/editor/collapsed-sections"
import { slideThumbWidth, useSlideSay, type SlideStrip, type StripSection } from "@/editor/slide-sidebar"
import { insertsFirst, type ToolbarTools } from "@/editor/toolbar-tools"
import { useZoomKeys } from "@/editor/zoom-keys"
import type { ExportRequest } from "@/export/export-deck"
import { cn } from "@/lib/class-names"

const noSections: readonly StripSection[] = []

const wideSlide = { width: 12_192_000, height: 6_858_000 }

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
  onSlideSelection,
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
  onSlideSelection?: (count: number) => void
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
    geometry: {
      rows: gridRows(strip),
      sections: (strip.sections ?? []).map((section) => section.start),
      rowHandles: strip.onMoveMany !== undefined,
      width,
      height: gridThumbHeight(width, strip.thumbHeight, slideThumbWidth),
    },
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
  const [touch, setTouch] = useState(false)
  const [elementPressed, setElementPressed] = useState(false)
  const [menu, setMenu] = useState<GridMenu | null>(null)
  const { current, count } = strip
  const picked = prunedPick(gridPick(state), count, strip.slideIds)
  const selected = new Set(gridRinged(state, current, count, strip.slideIds))
  const selectedCount = selected.size
  useLayoutEffect(() => onSlideSelection?.(selectedCount), [onSlideSelection, selectedCount])
  useGridSelection(strip.onSelection, selected, current)
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
  function zoomSelection() {
    if (edit.editing) {
      const boxes = strip.selectionBoxes?.(selection.ids)
      if (boxes !== undefined && boxes.length > 0) {
        viewport.elements(current, boxes, (size ?? wideSlide).width)
        return
      }
    }
    viewport.selection(edit.editing ? [current] : [...selected].filter(shown))
  }
  useZoomKeys(!presenting, (key) => {
    if (key === "selection") zoomSelection()
    else chooseZoom(key === "fit" ? "fit" : steppedZoom(key, percent, zoomRanges.grid))
  })
  const reachable = stop >= 0 && stop < count && shown(stop) ? stop : current
  const height = gridThumbHeight(width, strip.thumbHeight, slideThumbWidth)
  const spacing = gridSpacing(width, height)
  const rows = gridRows(strip)
  const focusRow = useGridRowFocus(list, rows, strip.slideIds ?? [])
  const columns = Math.max(1, ...rows.map((row) => row.end - row.start))
  const layoutWidth = columns * width + (columns - 1) * spacing.column
  const drag = useGridDrag({
    list,
    bar,
    ghost,
    viewport: viewport.handlers.ref,
    rows,
    selected: pickedSlides(picked, current),
    slideIds: strip.slideIds ?? [],
    panBy: viewport.panBy,
    onPanEnd: viewport.panEnd,
    onPick: (index, shift, toggle) => {
      flushSync(() => edit.pick(index, shift, toggle, picked))
      list.current
        ?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
        ?.focus({ preventScroll: true })
    },
    onMove: moveSlides,
  })
  const dragging = drag.dragging
  const scale = percent / 100
  const addBlocked =
    strip.onAdd === undefined ||
    count >= limits.slides ||
    viewport.space ||
    pointer?.tool === "hand" ||
    dragging !== null ||
    elementPressed ||
    edit.editing ||
    menu !== null ||
    touch ||
    !gridAddFits({
      width: width * scale,
      height: height * scale,
      columnGap: spacing.column * scale,
      rowGap: spacing.row * scale,
    })

  function moveSlides(held: readonly number[], at: number, row: boolean) {
    if (dragMoves(held, at, count).length === 0) return
    const first = landing(held, at)
    following.current = true
    if (row) focusRow(held, at)
    strip.onMoveMany?.(held, at, row ? "keep" : "same")
    edit.step({
      kind: "pick",
      pick:
        row || held.length === 1 ? null : { anchor: first, slides: new Set(held.map((_, offset) => first + offset)) },
    })
    announce(gridMoveMessage(rows, held, at, row))
  }

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

  const act = gridSlideActions(strip, picked, {
    follow: () => {
      following.current = true
    },
    pick: (pick) => edit.step({ kind: "pick", pick }),
    open: edit.open,
    moveSlides,
    announce,
  })

  function openMenu(index: number, anchor: MenuAnchor, pointer: boolean) {
    if (!selected.has(index)) {
      edit.step({ kind: "pick", pick: null })
      strip.onSelect(index)
    }
    setStop(index)
    setMenu({ index, anchor, pointer })
  }

  function closeMenu() {
    const shown = menu
    setMenu(null)
    if (shown === null) return
    list.current?.querySelector<HTMLElement>(`[data-slide-entry="${shown.index + 1}"]`)?.focus()
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (touch) setTouch(false)
    if (
      event.target instanceof Element &&
      event.target.closest("[data-add-row], [data-add-gap], [data-row-handle]") !== null
    )
      return
    edit.key(event)
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (
      event.target instanceof Element &&
      event.target.closest("[data-grid-edit], [data-add-gap], [data-row-handle]") !== null
    )
      return
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
      thumb={(screenWidth) => (
        <GridThumbnail paint={strip.thumb} index={index} width={width} scale={screenWidth / width} />
      )}
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
      addBlocked={addBlocked}
      onAdd={() => addAfter(index, true)}
    />
  )

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      inert={presenting}
      data-editor-grid
      data-keeps-selection
      onPointerMoveCapture={(event) => {
        if (touch && event.pointerType === "mouse") setTouch(false)
      }}
      onPointerDownCapture={(event) => {
        if (event.pointerType === "touch") setTouch(true)
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
        onSelection={zoomSelection}
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
          row={drag.row ? drag.held.map((index) => (size: number) => strip.thumb(index, size)) : undefined}
          count={drag.held.length}
          width={width}
          height={height}
          thumb={(size) => strip.thumb(dragging, size)}
        />
      )}
      {menu === null ? null : (
        <GridSlideMenu
          menu={menu}
          count={count}
          held={pickedSlides(picked, menu.index)}
          canMoveSet={strip.onMoveMany !== undefined}
          canChangeSet={strip.onChangeSet !== undefined}
          onAct={act}
          onClose={closeMenu}
        />
      )}
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
          <div className="flex flex-col" style={{ gap: spacing.row }}>
            {rows.map((row, number) => (
              <GridRowFrame
                key={row.start}
                number={number + 1}
                scale={percent / 100}
                height={height}
                blocked={
                  viewport.space ||
                  pointer?.tool === "hand" ||
                  dragging !== null ||
                  elementPressed ||
                  state.kind === "text" ||
                  edit.editing ||
                  strip.onMoveMany === undefined
                }
                onGrab={(event) => drag.grab(row.start, event, true)}
                onMove={(direction) => moveGridRow(rows, number, direction, moveSlides)}
              >
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
                    return (
                      <GridSectionCell
                        key={index}
                        row={row}
                        index={index}
                        sections={sections}
                        count={count}
                        scale={percent / 100}
                        pitch={width + spacing.column}
                        held={collapsed.held}
                        onToggle={collapsed.toggle}
                        shown={shown(index)}
                        height={height}
                      >
                        {card(index)}
                      </GridSectionCell>
                    )
                  })}
                </section>
                {addBlocked ? null : (
                  <GridRowAdd
                    row={number + 1}
                    width={width}
                    height={height}
                    gap={spacing.row}
                    scale={scale}
                    last={number === rows.length - 1}
                    onAdd={() => addBelow(row.start)}
                  />
                )}
              </GridRowFrame>
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
