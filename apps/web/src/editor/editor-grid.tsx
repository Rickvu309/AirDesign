import { editorOwnsKey, gridEscapeFromControl } from "@/editor/editor-key-ownership"
import { noSelection, type Selection } from "@airdesign/render"
import { limits } from "@airdesign/document"
import { toast } from "@/components/ui/toast"
import { useCallback, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { slideListCopy } from "@/copy/slide-list-copy"
import { steppedZoom, zoomRanges, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { EditorToolbar } from "@/editor/editor-toolbar"
import { cardPress } from "@/editor/grid-hit"
import { GridCard } from "@/editor/grid-card"
import { GridHead } from "@/editor/grid-head"
import { moveGridGroup, gridMoveMessage, useGridGroupFocus } from "@/editor/grid-group-frame"
import { gridAddFits } from "@/editor/grid-add-placement"
import { gridColumnCount, gridSpacing, gridThumbHeight } from "@/editor/grid-viewport"
import { GridDragGhost } from "@/editor/grid-drag-ghost"
import { gridDrop, type GridMoveSide } from "@/editor/grid-drop"
import { gridLayout, keptGridViewport, useKeptGridZoom } from "@/editor/grid-zoom"
import { gridOpened, gridStep } from "@/editor/grid-interaction"
import { GridThumbnail, useGridViewport } from "@/editor/use-grid-viewport"
import { useGridEditing } from "@/editor/use-grid-editing"
import { useGridMarquee } from "@/editor/use-grid-marquee"
import { useGridMenu } from "@/editor/use-grid-menu"
import type { SaveStatus } from "@/editor/use-deck-status"
import { focusMove, gridCommand } from "@/editor/editor-grid-keys"
import { gridSlideActions } from "@/editor/grid-slide-actions"
import { GridSlideMenu } from "@/editor/grid-menu"
import { gridContextMenu } from "@/editor/grid-context-menu"
import { pickAll, pickedSlides, pickRange } from "@/editor/grid-selection"
import { useGridDrag } from "@/editor/use-grid-drag"
import { useShownSelection } from "@/editor/use-grid-selection"
import type { ToolPick } from "@/editor/pointer-tool"
import { gridGroups } from "@/editor/grid-group"
import { GridGroups } from "@/editor/grid-groups"
import { slideThumbWidth, useSlideSay, type SlideStrip } from "@/editor/slide-sidebar"
import { insertsFirst, type ToolbarTools } from "@/editor/toolbar-tools"
import { useZoomKeys } from "@/editor/zoom-keys"
import type { ExportRequest } from "@/export/export-deck"
import { cn } from "@/lib/class-names"

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
  const focusedEntry = useRef<HTMLElement | null>(null)
  const gridTurn = useRef(tools.undo?.gridTurn)
  const [state, dispatch] = useReducer(gridStep, selection.ids.length > 0, gridOpened)
  const bar = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const following = useRef(keptGridViewport(id) === null)
  const [stop, setStop] = useState(strip.current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [zoom, setZoom] = useKeptGridZoom(id)
  const [fitPercent, setFitPercent] = useState(25)
  const percent = zoom === "fit" ? fitPercent : zoom
  const scale = percent / 100
  const hand = pointer?.tool === "hand"
  const fit = gridLayout(100, size ?? wideSlide, strip.count)
  const width = fit.width
  const groups = gridGroups(strip)
  const { current, count } = strip
  const named = strip.groups ?? []
  const height = gridThumbHeight(width, strip.thumbHeight, slideThumbWidth)
  const geometry = {
    groups,
    named: named.flatMap((group) => (group.name === null ? [] : [group.start])),
    groupHandles: strip.onMoveMany !== undefined,
    width,
    height,
  }
  const viewport = useGridViewport({
    geometry,
    deck: id,
    world: list,
    scale,
    hand,
    working: !presenting,
    onZoom: setZoom,
    onFit: setFitPercent,
    selected: stop,
    slideWidth: (size ?? wideSlide).width,
    elementsOf: () => strip.selectionBoxes?.(selection.ids),
    initialFit: zoom === "fit",
    fitting: zoom === "fit",
    layout: `${strip.count}:${strip.gridStarts?.join(",") ?? ""}:${strip.groups?.map((group) => group.start).join(",") ?? ""}`,
  })
  function chooseZoom(next: Zoom) {
    setZoom(next)
    if (next === "fit") viewport.reset()
  }
  const [touch, setTouch] = useState(false)
  const [elementPressed, setElementPressed] = useState(false)
  const { picked, selected } = useShownSelection(state, strip, onSlideSelection)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  const edit = useGridEditing({
    world: list,
    state,
    dispatch,
    current,
    select,
    onSelect: strip.onSelect,
    announce,
  })
  const slideMenu = useGridMenu({
    list,
    groups,
    picked,
    selected,
    step: edit.step,
    onSelect: strip.onSelect,
    onStop: setStop,
    moveSlides,
  })
  const { menu } = slideMenu
  const marquee = useGridMarquee({ list, viewport, edit, strip, state, selection, select, hand, announce })
  useSlideSay(strip.say, announce)
  const order = strip.slideIds?.join(",")
  const starts = strip.gridStarts?.join(",")
  useLayoutEffect(() => {
    if (gridTurn.current !== tools.undo?.gridTurn) {
      const index = [...selected][0] ?? current
      gridTurn.current = tools.undo?.gridTurn
      setStop(index)
      const card = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${index + 1}"]`)
      if (card) viewport.focus(card, tools.undo?.gridFocusVisible === true)
    } else if (following.current) {
      const next = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${current + 1}"]`)
      setStop(current)
      if (next && next === document.activeElement) viewport.reveal(next)
      else next?.focus({ preventScroll: true })
    } else if (focusedEntry.current?.isConnected) {
      setStop(Number(focusedEntry.current.dataset.slideEntry) - 1)
      if (document.activeElement === document.body) viewport.focus(focusedEntry.current)
    }
    following.current = false
  }, [current, count, order, starts, tools.undo?.gridTurn])
  function zoomSelection() {
    if (edit.editing) {
      const boxes = strip.selectionBoxes?.(selection.ids)
      if (boxes !== undefined && boxes.length > 0) {
        viewport.elements(current, boxes, (size ?? wideSlide).width)
        return
      }
    }
    viewport.selection(edit.editing ? [current] : [...selected])
  }
  useZoomKeys(!presenting, (key) => {
    if (key === "selection") zoomSelection()
    else chooseZoom(key === "fit" ? "fit" : steppedZoom(key, percent, zoomRanges.grid))
  })
  const spacing = gridSpacing(width, height)
  const focusGroup = useGridGroupFocus(list, groups, strip.slideIds ?? [])
  const columns = gridColumnCount(geometry)
  const layoutWidth = columns * width + (columns - 1) * spacing.column
  const drag = useGridDrag({
    list,
    bar,
    ghost,
    viewport: viewport.handlers.ref,
    groups,
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
  const addBlocked =
    strip.onAdd === undefined ||
    count >= limits.slides ||
    viewport.space ||
    hand ||
    dragging !== null ||
    marquee.active ||
    elementPressed ||
    edit.editing ||
    menu !== null ||
    touch ||
    !gridAddFits({
      width: width * scale,
      height: height * scale,
      columnGap: spacing.column * scale,
      rowGap: spacing.line * scale,
    })

  function moveSlides(held: readonly number[], at: number, side: GridMoveSide) {
    const first = gridDrop(groups, held, at, side)
    if (first === null || strip.onMoveMany === undefined) return
    const group = side === "keep"
    following.current = true
    if (group) focusGroup(held, at)
    strip.onMoveMany(held, at, side)
    edit.step({
      kind: "pick",
      pick:
        group || held.length === 1 ? null : { anchor: first, slides: new Set(held.map((_, offset) => first + offset)) },
    })
    announce(gridMoveMessage(groups, held, at, group))
  }

  function addSlide(index: number, side: "same" | "new", keep: boolean) {
    if (strip.onAdd === undefined) return
    if (count >= limits.slides) {
      toast.error(slideListCopy.addLimit(limits.slides))
      return
    }
    following.current = true
    if (keep) {
      edit.step({ kind: "pick", pick: null })
      if (zoom === "fit") setZoom(percent)
    }
    strip.onAdd(undefined, index, side)
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

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (touch) setTouch(false)
    if (
      event.target instanceof Element &&
      event.target.closest("[data-add-group], [data-add-gap], [data-group-handle]") !== null
    )
      return
    edit.key(event)
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (
      event.target instanceof Element &&
      event.target.closest("[data-grid-edit], [data-add-gap], [data-group-handle]") !== null
    )
      return
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      const card = document.activeElement?.closest<HTMLElement>("[data-slide-entry]")
      if (card === null || card === undefined) return
      event.preventDefault()
      slideMenu.open(Number(card.dataset.slideEntry) - 1, card, false)
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
      skipped={strip.skipped?.[index] === true}
      selected={selected.has(index)}
      multiple={picked !== null}
      reachable={index === stop}
      dragging={drag.held.includes(index)}
      busy={dragging !== null}
      active={edit.editing && index === current && slide !== undefined}
      scale={scale}
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
      onContextMenu={(event) => gridContextMenu(event, index, slideMenu.open)}
      groupEnd={groups.some((group) => group.end === index + 1)}
      addBlocked={addBlocked}
      onAdd={() => addSlide(index, "same", true)}
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
      onKeyDown={(event) => {
        if (gridEscapeFromControl(event)) edit.key(event, true)
      }}
      onFocusCapture={(event) => {
        focusedEntry.current = event.target.closest("[data-slide-entry]")
        edit.focus(event)
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget))
          focusedEntry.current = null
      }}
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
        canvas={list}
        onSelection={zoomSelection}
        onAdd={() => addSlide(stop, "same", false)}
        onSlides={onSlides}
        onExport={onExport}
        {...(onRename === undefined ? {} : { onRename })}
        {...(onTrash === undefined ? {} : { onTrash })}
        {...(onPresent === undefined ? {} : { onPresent: () => onPresent(stop) })}
      />
      <Announcer message={message} />
      {dragging === null ? null : (
        <GridDragGhost
          ref={ghost}
          group={drag.group ? drag.held.map((index) => (size: number) => strip.thumb(index, size)) : undefined}
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
          canMoveBelow={slideMenu.canMoveBelow}
          canChangeSet={strip.onChangeSet !== undefined}
          canAdd={strip.onAdd !== undefined}
          onAdd={(side) => addSlide(menu.index, side, true)}
          onMoveBelow={slideMenu.moveBelow}
          onAct={act}
          onClose={slideMenu.close}
          skipped={strip.skipped}
          onSkip={strip.onSkip}
        />
      )}
      <div
        {...viewport.handlers}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden touch-none after:pointer-events-none after:absolute after:inset-0 after:content-['']",
          "has-[>[data-focus-edge]:focus-visible]:after:shadow-[inset_0_0_0_var(--focus-ring-width)_var(--focus-ring)]",
          (hand || viewport.space) && "cursor-grab active:cursor-grabbing [&_*]:cursor-[inherit]",
        )}
        onPointerDown={marquee.press}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-grid-card], [data-group-head]") === null)
            edit.clear()
        }}
        data-hover-disabled={
          viewport.space || hand || dragging !== null || marquee.active || elementPressed ? "true" : undefined
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
            style={{ width: 4 / scale, borderRadius: 2 / scale }}
          />
          <GridGroups
            geometry={geometry}
            named={named}
            ids={strip.slideIds}
            columns={columns}
            scale={scale}
            renderCard={card}
            addBlocked={addBlocked}
            groupBlocked={
              viewport.space ||
              hand ||
              dragging !== null ||
              elementPressed ||
              edit.editing ||
              strip.onMoveMany === undefined
            }
            onGrab={(index, event) => drag.grab(index, event, true)}
            onMove={(number, direction) => moveGridGroup(groups, number, direction, moveSlides)}
            onAdd={(index) => addSlide(index, "new", true)}
          />
        </div>
        {marquee.box}
      </div>
      <div className="flex shrink-0 justify-center pb-6">
        <EditorToolbar {...insertsFirst(tools, edit.activate)} />
      </div>
    </div>
  )
}
