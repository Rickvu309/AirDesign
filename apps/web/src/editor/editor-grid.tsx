import * as doom from "@airdesign/doom"
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { Zoom } from "@/editing/canvas-zoom"
import { gestureFor } from "@/lib/gestures"
import { cn } from "@/lib/class-names"
import { GridHead, Island, type GridHeadProps } from "@/editor/editor-chrome"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gridCommand, gridMove } from "@/editor/editor-grid-keys"
import { gridAddFits } from "@/editor/grid-add-placement"
import { GridDragGhost } from "@/editor/grid-drag-marks"
import { gridBands, gridRanges } from "@/editor/grid-drop"
import { useGroupHover } from "@/editor/grid-group-frame"
import {
  gridLiveSlide,
  gridOpened,
  gridPick,
  gridRinged,
  gridStep,
  type GridInteraction,
} from "@/editor/grid-interaction"
import { gridEntryOf } from "@/editor/grid-hit"
import type { Selection } from "@/editor/selection"
import { useGridEditing } from "@/editor/use-grid-editing"
import type { CanvasCard } from "@/editor/canvas"
import type { ActionRun } from "@/editor/actions-popover"
import { gridLayout, gridSpacing } from "@/editor/grid-lines"
import { gridZoomPlacement } from "@/editor/grid-number"
import { marqueeStep, type MarqueeDeck } from "@/editor/grid-marquee"
import { pickAll, pickRange, pickToggle, prunedPick, toggledCurrent } from "@/editor/grid-selection"
import { GridSheet } from "@/editor/grid-sheet"
import { gridGripsShown, gridPaintMargin, gridShown, type GridView } from "@/editor/grid-viewport"
import { GridSlideMenu } from "@/editor/grid-slide-menu"
import { useSlideSay, type SlideStrip } from "@/editor/slide-sidebar"
import { slideGroupsOf } from "@/editor/slide-writes"
import { useGridCamera } from "@/editor/use-grid-camera"
import { useGridCarry } from "@/editor/use-grid-carry"
import { useGridDrag } from "@/editor/use-grid-drag"
import { useGridMarquee } from "@/editor/use-grid-marquee"
import { pointAt, useGridSlideActions } from "@/editor/use-grid-slide-actions"

const paintMargin = gridPaintMargin

export type GridShownZoom = { readonly percent: number; readonly fit: boolean; readonly selection: boolean }

export type GridCommands = { readonly zoomTo: (zoom: Zoom) => void; readonly zoomSelection: () => void }

export type GridStart = {
  readonly picked?: readonly number[]
  readonly camera?: GridView
  readonly menu?: number
  readonly editing?: boolean
}

function opened(start: GridStart, order: readonly string[], at: number): GridInteraction {
  const slide = order[at]
  if (start.editing === true && slide !== undefined) return { kind: "elements", slide }
  const picked = start.picked?.flatMap((index) => order[index] ?? []) ?? []
  const [anchor] = picked
  return anchor === undefined ? gridOpened : { kind: "slides", pick: { anchor, slides: new Set(picked) } }
}

function entryOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null
  const entry = target.closest("[data-grid-card]")?.querySelector("[data-slide-entry]")
  const number = Number(entry?.getAttribute("data-slide-entry"))
  return Number.isInteger(number) && number > 0 ? number - 1 : null
}

export function EditorGrid({
  deck,
  view,
  strip,
  onOpen,
  hand,
  onHand,
  head,
  right,
  bar,
  assetUrl,
  onShown,
  onCommands,
  selection,
  onSelection,
  onEditing,
  onBegin,
  onRun,
  live,
  start = {},
}: {
  readonly deck: string
  readonly view: doom.Doom
  readonly strip: SlideStrip
  readonly onOpen: (index: number) => void
  readonly hand: boolean
  readonly onHand: (hand: boolean) => void
  readonly head: Omit<GridHeadProps, "selected">
  readonly right: ReactNode
  readonly bar: ReactNode
  readonly assetUrl: (asset: string) => string | undefined
  readonly onShown: (shown: GridShownZoom) => void
  readonly onCommands: (commands: GridCommands | null) => void
  readonly selection: readonly doom.NodeId[]
  readonly onSelection: (next: Selection) => void
  readonly onEditing: (live: boolean) => void
  readonly onBegin: (begin: (() => void) | null) => void
  readonly onRun: (run: ActionRun) => void
  readonly live: (slide: doom.NodeId, scale: number, card: CanvasCard) => ReactNode
  readonly start?: GridStart
}) {
  const { current } = strip
  const { size } = doom.deckOf(view)
  const layout = useMemo(
    () =>
      gridLayout(
        slideGroupsOf(view).map((group) => group.slides),
        { width: size.w, height: size.h },
      ),
    [view, size.w, size.h],
  )
  const count = layout.cards.length
  const order = useMemo(() => layout.cards.map((card) => card.id), [layout])
  const shape = useMemo(
    () =>
      slideGroupsOf(view)
        .map((group) => `${group.group}:${group.slides.join(",")}`)
        .join("|"),
    [view],
  )
  const groups = useMemo(() => gridRanges(layout), [layout])
  const bands = useMemo(() => gridBands(layout), [layout])
  const [state, dispatch] = useReducer(gridStep, start, (begin) => opened(begin, order, current))
  const picked = prunedPick(gridPick(state), order)
  const ringed = gridRinged(state, order, current)
  const list = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const quiet = useRef(false)
  const chosen = useRef<number | null>(current)
  const [stop, setStop] = useState(current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [gripFocus, setGripFocus] = useState<number | null>(null)
  const [touch, setTouch] = useState(false)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  useSlideSay(strip.say, announce)

  function choose(index: number) {
    if (index === current) return
    chosen.current = index
    strip.onSelect(index)
  }

  const spacing = gridSpacing({ width: size.w, height: size.h })
  const edit = useGridEditing({
    list,
    state,
    dispatch,
    current,
    layout,
    line: spacing.line,
    view,
    selected: selection,
    onCurrent: choose,
    onSelection,
    announce,
  })
  const camera = useGridCamera({
    deck,
    layout,
    ringed,
    elements: edit.frame,
    hand,
    onHand,
    sheet: list,
    ...(start.camera === undefined ? {} : { start: start.camera }),
  })
  edit.scaleNow.current = () => camera.viewNow().scale
  edit.handNow.current = hand
  edit.spaceNow.current = camera.space
  edit.slideAt.current = (index, client) => {
    const card = layout.cards[index]
    return card === undefined ? null : camera.slidePoint(card, client)
  }
  const shown = camera.gliding.current ? camera.viewNow() : camera.view
  const scale = shown.scale
  const painted = new Set(gridShown(layout, shown, camera.room, paintMargin))
  const placement = gridZoomPlacement(layout, scale)
  const deckOf: MarqueeDeck = { current, order }

  function focusCard(index: number, reveal: boolean) {
    quiet.current = !reveal
    list.current
      ?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
      ?.focus({ preventScroll: true })
    quiet.current = false
  }

  function pickedNow(next: GridInteraction) {
    if (next.kind !== "slides") {
      list.current?.focus({ preventScroll: true })
      announce(slideListCopy.nothingSelected)
      return
    }
    const now = toggledCurrent(next.pick, order, current)
    if (now !== current) choose(now)
    focusCard(now, false)
    announce(slideListCopy.selected(gridRinged(next, order, now).length))
  }

  const marquee = useGridMarquee({
    camera,
    layout,
    state,
    deck: deckOf,
    hand,
    onStep: edit.step,
    onEnd: (before, held, hits, adding) => pickedNow(gridStep(before, marqueeStep(before, held, hits, adding))),
  })

  function pick(index: number, shift: boolean, toggle: boolean) {
    if (!shift && !toggle) {
      edit.step({ kind: "pick", pick: null })
      choose(index)
      return
    }
    const next = shift ? pickRange(picked, order, index, current) : pickToggle(picked, order, index, current)
    edit.step({ kind: "pick", pick: next })
    if (next !== null) announce(slideListCopy.selected(next.slides.size))
    choose(toggledCurrent(next, order, index))
  }

  function clear() {
    if (state.kind === "none") return
    edit.step({ kind: "clear" })
    list.current?.focus({ preventScroll: true })
    announce(slideListCopy.nothingSelected)
  }

  useLayoutEffect(() => {
    const focused = document.activeElement
    if (focused === null || focused === document.body) focusCard(current, false)
  }, [])

  const liveSlide = gridLiveSlide(state)
  useLayoutEffect(() => {
    if (liveSlide === null) return
    const index = order.findIndex((id) => id === liveSlide)
    if (index >= 0) {
      if (index !== current) choose(index)
      return
    }
    edit.step({ kind: "pick", pick: null })
    chosen.current = current
    if (order.length === 0) return
    focusCard(Math.min(current, order.length - 1), false)
    announce(slideListCopy.selected(1))
  }, [liveSlide, order, current])

  useLayoutEffect(() => {
    if (chosen.current === current) {
      chosen.current = null
      return
    }
    chosen.current = null
    setStop(current)
    const focused = document.activeElement
    if (focused === null || focused === document.body || root.current?.contains(focused) === true)
      focusCard(current, true)
    else camera.reveal(current)
  }, [current, count])

  const actions = useGridSlideActions({
    strip,
    layout,
    groups,
    picked,
    root,
    announce,
    dispatch,
    choose,
    onOpen,
    onAdding: camera.hold,
  })
  const drag = useGridDrag({
    camera,
    layout,
    groups,
    selected: actions.held,
    shape,
    panning: hand || camera.space,
    ghost,
    onMove: actions.moveSlides,
  })
  useLayoutEffect(() => {
    if (start.menu === undefined) return
    const shown = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${String(start.menu + 1)}"]`)
    if (shown !== null && shown !== undefined) actions.openMenu(start.menu, shown, false)
  }, [])
  const latestAdd = useRef(actions.add)
  useLayoutEffect(() => {
    latestAdd.current = actions.add
  })
  const addAfter = useCallback((index: number) => latestAdd.current(index, "same"), [])

  const percent = Math.round(scale * 100)
  const canZoom = ringed.length > 0 || edit.frame !== null
  useLayoutEffect(() => {
    if (camera.gliding.current) return
    onShown({ percent, fit: camera.fit, selection: canZoom })
  }, [onShown, percent, camera.fit, canZoom, camera.settled])
  useLayoutEffect(() => onEditing(edit.editing), [onEditing, edit.editing])
  useLayoutEffect(() => {
    onBegin(edit.begin)
    return () => onBegin(null)
  }, [onBegin, edit.begin])

  useLayoutEffect(() => {
    onCommands({ zoomTo: (zoom) => camera.zoomTo(zoom, ringed[0]), zoomSelection: camera.zoomSelection })
  })
  useLayoutEffect(() => () => onCommands(null), [onCommands])

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (touch) setTouch(false)
    if (event.target instanceof Element && event.target.closest("[data-add-gap]") !== null) return
    if (edit.inLive(event.target)) return
    const gesture = gestureFor(event.nativeEvent, "grid")
    const index = gridEntryOf(event.target)
    if (gesture === "select-all") {
      event.preventDefault()
      const all = pickAll(order, current)
      edit.step({ kind: "pick", pick: all })
      if (all !== null) announce(slideListCopy.selected(all.slides.size))
      return
    }
    if (index === null) return
    const command = gridCommand(event.nativeEvent)
    if (command !== null) {
      event.preventDefault()
      if (command === "open") edit.open(index)
      else if (command === "menu" && event.target instanceof HTMLElement) actions.openMenu(index, event.target, false)
      else actions.act(command, index)
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const to = gridMove(event.key, layout.cards, index)
    if (to === null) return
    event.preventDefault()
    focusCard(to, true)
    if (event.shiftKey) {
      const next = pickRange(picked, order, to, current)
      edit.step({ kind: "pick", pick: next })
      if (next !== null) announce(slideListCopy.selected(next.slides.size))
    } else edit.step({ kind: "pick", pick: null })
    choose(to)
  }

  function onCardPress(event: MouseEvent<HTMLDivElement>) {
    if (edit.inLive(event.target)) return
    if (gridEntryOf(event.target) !== null) event.preventDefault()
  }

  function onCardGrab(event: PointerEvent<HTMLDivElement>) {
    if (edit.inLive(event.target)) return
    const index = entryOf(event.target)
    if (index !== null) drag.grab(index, event)
  }

  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    if (edit.swallowed(event) || edit.inLive(event.target)) return
    const index = gridEntryOf(event.target)
    if (index === null) return
    focusCard(index, true)
    pick(index, event.shiftKey, event.metaKey || event.ctrlKey)
  }

  function onCardMenu(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index === null) return
    event.preventDefault()
    focusCard(index, false)
    actions.openMenu(index, pointAt(event.clientX, event.clientY), true)
  }

  function onCardFocus(event: FocusEvent<HTMLDivElement>) {
    const index = gridEntryOf(event.target)
    if (index === null) return
    setStop(index)
    if (event.target instanceof Element && event.target.closest("[data-grid-edit]") !== null) return
    if (!quiet.current) camera.reveal(index)
  }

  const preview = drag.preview
  const { carried, carry } = useGridCarry({
    layout,
    live: liveSlide,
    geometries: edit.geometries,
    camera,
    land: edit.land,
  })
  const lifting = preview !== null || carried !== null
  const gripBlocked = hand || camera.space || lifting || marquee.box !== null
  const grips = strip.onMoveGroups !== undefined && gridGripsShown(size.h, scale)

  const grouped = useGroupHover({ host: camera.handlers.ref, bands, scale, world: camera.world, blocked: gripBlocked })
  const hover = grouped.hover

  const selected = new Set(ringed)
  const box = marquee.box
  const reachable = stop < count ? stop : current
  const menu = actions.menu
  const addBlocked =
    strip.onAdd === undefined ||
    actions.full ||
    camera.space ||
    hand ||
    lifting ||
    box !== null ||
    menu !== null ||
    touch ||
    !gridAddFits({
      width: size.w * scale,
      height: size.h * scale,
      columnGap: spacing.column * scale,
      rowGap: spacing.line * scale,
    })
  const held = new Set(preview?.held ?? [])
  const dropBar = drag.bar
  return (
    <div
      ref={root}
      className="flex h-full min-w-0 flex-1 flex-col bg-canvas"
      data-editor-grid
      data-grid-view
      onPointerDownCapture={(event) => setTouch(event.pointerType === "touch")}
      onPointerMoveCapture={(event) => {
        if (touch && event.pointerType === "mouse") setTouch(false)
      }}
      onKeyDown={edit.escape}
    >
      <header className="flex h-24 shrink-0 items-start justify-between gap-3 px-3 pt-3">
        <GridHead {...head} selected={picked === null ? null : picked.slides.size} />
        {right === undefined ? null : <Island>{right}</Island>}
      </header>
      <Announcer message={message} />
      <div
        {...camera.handlers}
        tabIndex={-1}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden outline-none select-none",
          (hand || camera.space) && "cursor-grab active:cursor-grabbing [&_*]:cursor-[inherit]",
        )}
        onPointerDown={marquee.press}
        onPointerMove={(event) => {
          camera.handlers.onPointerMove(event)
          grouped.move(event)
        }}
        onClick={(event) => {
          if (marquee.swallowedClick()) return
          if (gridEntryOf(event.target) === null) clear()
        }}
        data-grid-viewport
        data-marquee={box === null ? undefined : ""}
        data-dragging={lifting ? "" : undefined}
        data-focus-edge
      >
        <div
          ref={list}
          tabIndex={-1}
          role="group"
          aria-label={slideListCopy.listName}
          className="absolute top-0 left-0 outline-none"
          style={{
            transform: `translate(${String(shown.x)}px, ${String(shown.y)}px) scale(${String(shown.scale)})`,
            transformOrigin: "0 0",
          }}
          data-slide-list
          data-focus-edge
          onKeyDown={onKey}
          onPointerDownCapture={edit.press}
          onPointerDown={onCardGrab}
          onMouseDown={onCardPress}
          onClick={onCardClick}
          onDoubleClick={(event) => edit.editOrOpen(event, onOpen)}
          onContextMenu={onCardMenu}
          onFocus={onCardFocus}
        >
          <GridSheet
            bands={bands}
            cards={layout.cards}
            groups={groups}
            view={view}
            count={count}
            placement={placement}
            painted={painted}
            current={current}
            selected={selected}
            multiple={picked !== null}
            reachable={reachable}
            assetUrl={assetUrl}
            held={held}
            still={drag.still}
            shift={drag.shift}
            spacing={spacing}
            addBlocked={addBlocked}
            onAddGap={addAfter}
            onAddGroup={(index) => actions.add(index, "new")}
            liveSlide={liveSlide}
            live={live}
            carry={carry}
            taking={carried?.over ?? null}
            handoff={edit.handoff}
            onBlank={edit.blank}
            onMode={edit.mode}
            onGeometry={edit.onGeometry}
            onRun={onRun}
            slidePoint={camera.slidePoint}
            grips={grips}
            blocked={gripBlocked}
            hover={hover}
            gripFocus={gripFocus}
            onGrab={(index, event) => drag.grab(index, event, true)}
            onMoveSlides={actions.moveSlides}
            clearHover={grouped.clear}
            onFocusGrip={setGripFocus}
            dropBar={dropBar}
            marquee={box}
            scale={scale}
          />
        </div>
      </div>
      {preview === null ? null : (
        <GridDragGhost
          ref={ghost}
          view={view}
          slides={preview.held.flatMap((index) => order[index] ?? [])}
          group={preview.group}
          size={{ width: size.w, height: size.h }}
          assetUrl={assetUrl}
        />
      )}
      {menu === null ? null : (
        <GridSlideMenu menu={menu} actions={actions} strip={strip} count={count} onOpen={onOpen} />
      )}
      <div className="flex shrink-0 justify-center pt-2 pb-6">{bar}</div>
    </div>
  )
}
