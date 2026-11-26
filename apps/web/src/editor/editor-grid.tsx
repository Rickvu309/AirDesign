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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { Zoom } from "@/editing/canvas-zoom"
import { gestureFor } from "@/lib/gestures"
import { cn } from "@/lib/class-names"
import { GridHead, Island, type GridHeadProps } from "@/editor/editor-chrome"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gridCommand, gridMove } from "@/editor/editor-grid-keys"
import { gridAddFits } from "@/editor/grid-add-placement"
import { GridCard } from "@/editor/grid-card"
import { GridDragGhost } from "@/editor/grid-drag-ghost"
import { gridBands, gridIndices, gridRanges } from "@/editor/grid-drop"
import { GridGroupAdd } from "@/editor/grid-group-add"
import { GridGroupFrame, type GridGroupHover } from "@/editor/grid-group-frame"
import { gridOpened, gridPick, gridRinged, gridStep, type GridInteraction } from "@/editor/grid-interaction"
import { gridLayout, gridSpacing } from "@/editor/grid-lines"
import { gridZoomPlacement } from "@/editor/grid-number"
import { marqueeStep, type MarqueeDeck } from "@/editor/grid-marquee"
import { pickAll, pickRange, pickToggle, prunedPick, toggledCurrent } from "@/editor/grid-selection"
import { gridGrip, gridGripsShown, gridPaintMargin, gridShown, type GridView } from "@/editor/grid-viewport"
import { SlideMenu, slideMenuItem } from "@/editor/slide-menu"
import { useSlideSay, type SlideStrip } from "@/editor/slide-sidebar"
import { slideGroupsOf } from "@/editor/slide-writes"
import { useGridCamera } from "@/editor/use-grid-camera"
import { useGridDrag } from "@/editor/use-grid-drag"
import { useGridMarquee } from "@/editor/use-grid-marquee"
import { pointAt, useGridSlideActions } from "@/editor/use-grid-slide-actions"

export type GridShownZoom = { readonly percent: number; readonly fit: boolean; readonly selection: boolean }

export type GridCommands = { readonly zoomTo: (zoom: Zoom) => void; readonly zoomSelection: () => void }

export type GridStart = { readonly picked?: readonly number[]; readonly camera?: GridView }

function opened(start: GridStart, order: readonly string[]): GridInteraction {
  const picked = start.picked?.flatMap((index) => order[index] ?? []) ?? []
  const [anchor] = picked
  return anchor === undefined ? gridOpened : { kind: "slides", pick: { anchor, slides: new Set(picked) } }
}

const gripReach = 52

function entryOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null
  const entry = target.closest("[data-grid-card]")?.querySelector("[data-slide-entry]")
  const number = Number(entry?.getAttribute("data-slide-entry"))
  return Number.isInteger(number) && number > 0 ? number - 1 : null
}

function partOf(target: EventTarget | null): GridGroupHover {
  if (!(target instanceof Element)) return "band"
  if (target.closest("[data-group-handle]") !== null) return "handle"
  if (target.closest("[data-gap-insert], [data-group-insert]") !== null) return "add"
  return target.closest("[data-grid-card]") === null ? "band" : "slide"
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
  const groups = useMemo(() => gridRanges(layout), [layout])
  const bands = useMemo(() => gridBands(layout), [layout])
  const [state, dispatch] = useReducer(gridStep, start, (begin) => opened(begin, order))
  const picked = prunedPick(gridPick(state), order)
  const ringed = gridRinged(state, order, current)
  const list = useRef<HTMLDivElement>(null)
  const camera = useGridCamera({
    deck,
    layout,
    ringed,
    hand,
    onHand,
    sheet: list,
    ...(start.camera === undefined ? {} : { start: start.camera }),
  })
  const live = camera.gliding.current ? camera.viewNow() : camera.view
  const scale = live.scale
  const placement = gridZoomPlacement(layout, scale)
  const painted = new Set(gridShown(layout, live, camera.room, gridPaintMargin))
  const root = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const quiet = useRef(false)
  const chosen = useRef<number | null>(current)
  const [stop, setStop] = useState(current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [hover, setHover] = useState<{ readonly group: number; readonly part: GridGroupHover } | null>(null)
  const [gripFocus, setGripFocus] = useState<number | null>(null)
  const [touch, setTouch] = useState(false)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  useSlideSay(strip.say, announce)
  const deckOf: MarqueeDeck = { current, order }

  function focusCard(index: number, reveal: boolean) {
    quiet.current = !reveal
    list.current
      ?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
      ?.focus({ preventScroll: true })
    quiet.current = false
  }

  function choose(index: number) {
    if (index === current) return
    chosen.current = index
    strip.onSelect(index)
  }

  function pickedNow(next: GridInteraction) {
    if (next.kind === "none") {
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
    onStep: dispatch,
    onEnd: (before, held, hits, adding) => pickedNow(gridStep(before, marqueeStep(before, held, hits, adding))),
  })

  function pick(index: number, shift: boolean, toggle: boolean) {
    if (!shift && !toggle) {
      dispatch({ kind: "pick", pick: null })
      choose(index)
      return
    }
    const next = shift ? pickRange(picked, order, index, current) : pickToggle(picked, order, index, current)
    dispatch({ kind: "pick", pick: next })
    if (next !== null) announce(slideListCopy.selected(next.slides.size))
    choose(toggledCurrent(next, order, index))
  }

  function clear() {
    if (state.kind === "none") return
    dispatch({ kind: "clear" })
    list.current?.focus({ preventScroll: true })
    announce(slideListCopy.nothingSelected)
  }

  useLayoutEffect(() => {
    const focused = document.activeElement
    if (focused === null || focused === document.body) focusCard(current, false)
  }, [])

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
    order: order.join(","),
    ghost,
    onMove: actions.moveSlides,
  })
  const latestAdd = useRef(actions.add)
  useLayoutEffect(() => {
    latestAdd.current = actions.add
  })
  const addAfter = useCallback((index: number) => latestAdd.current(index, "same"), [])

  const percent = Math.round(scale * 100)
  const selection = ringed.length > 0
  useLayoutEffect(() => {
    if (camera.gliding.current) return
    onShown({ percent, fit: camera.fit, selection })
  }, [onShown, percent, camera.fit, selection, camera.settled])

  useLayoutEffect(() => {
    onCommands({ zoomTo: (zoom) => camera.zoomTo(zoom, ringed[0]), zoomSelection: camera.zoomSelection })
  })
  useLayoutEffect(() => () => onCommands(null), [onCommands])

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    if (touch) setTouch(false)
    if (event.target instanceof Element && event.target.closest("[data-add-gap]") !== null) return
    const gesture = gestureFor(event.nativeEvent, "grid")
    const index = entryOf(event.target)
    if (gesture === "select-all") {
      event.preventDefault()
      const all = pickAll(order, current)
      dispatch({ kind: "pick", pick: all })
      if (all !== null) announce(slideListCopy.selected(all.slides.size))
      return
    }
    if (gesture === "deselect") {
      if (state.kind === "none") return
      event.preventDefault()
      dispatch({ kind: "escape" })
      announce(slideListCopy.nothingSelected)
      return
    }
    if (index === null) return
    const command = gridCommand(event.nativeEvent)
    if (command !== null) {
      event.preventDefault()
      if (command === "menu" && event.target instanceof HTMLElement) actions.openMenu(index, event.target, false)
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
      dispatch({ kind: "pick", pick: next })
      if (next !== null) announce(slideListCopy.selected(next.slides.size))
    } else dispatch({ kind: "pick", pick: null })
    choose(to)
  }

  function onCardPress(event: MouseEvent<HTMLDivElement>) {
    if (entryOf(event.target) !== null) event.preventDefault()
  }

  function onCardGrab(event: PointerEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index !== null) drag.grab(index, event)
  }

  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index === null) return
    focusCard(index, true)
    pick(index, event.shiftKey, event.metaKey || event.ctrlKey)
  }

  function onCardDouble(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index !== null && !event.shiftKey && !event.metaKey && !event.ctrlKey) onOpen(index)
  }

  function onCardMenu(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index === null) return
    event.preventDefault()
    focusCard(index, false)
    actions.openMenu(index, pointAt(event.clientX, event.clientY), true)
  }

  function onCardFocus(event: FocusEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index === null) return
    setStop(index)
    if (!quiet.current) camera.reveal(index)
  }

  const preview = drag.preview
  const gripBlocked = hand || camera.space || preview !== null || marquee.box !== null
  const grips = strip.onMoveGroups !== undefined && gridGripsShown(size.h, scale)

  function onHover(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || gripBlocked) {
      if (hover !== null) setHover(null)
      return
    }
    const world = camera.world({ x: event.clientX, y: event.clientY })
    const part = partOf(event.target)
    const reach = gripReach / scale
    const above = gridGrip.minimumHeight / 2 / scale
    const group =
      part === "add"
        ? bands.findLastIndex((band) => band.top <= world.y)
        : bands.findIndex(
            (band) =>
              world.x >= -reach && world.x <= band.width && world.y >= band.top - above && world.y <= band.bottom,
          )
    const next = group === -1 ? null : { group, part }
    if (next?.group !== hover?.group || next?.part !== hover?.part) setHover(next)
  }

  const spacing = gridSpacing({ width: size.w, height: size.h })
  const selected = new Set(ringed)
  const box = marquee.box
  const reachable = stop < count ? stop : current
  const menu = actions.menu
  const addBlocked =
    strip.onAdd === undefined ||
    actions.full ||
    camera.space ||
    hand ||
    preview !== null ||
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
  const tinted = (group: number) =>
    !gripBlocked &&
    grips &&
    (hover?.group === group ? hover.part === "handle" : gripFocus === group && hover?.part !== "add")
  const dropBar = drag.bar
  const inRoom = (left: number, top: number, width: number, height: number) => {
    const x = camera.view.x + left * scale
    const y = camera.view.y + top * scale
    return x >= 0 && y >= 0 && x + width * scale <= camera.room.width && y + height * scale <= camera.room.height
  }
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
          onHover(event)
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => {
          if (marquee.swallowedClick()) return
          if (entryOf(event.target) === null) clear()
        }}
        data-grid-viewport
        data-marquee={box === null ? undefined : ""}
        data-dragging={preview === null ? undefined : ""}
        data-focus-edge
      >
        <div
          ref={list}
          tabIndex={-1}
          role="group"
          aria-label={slideListCopy.listName}
          className="absolute top-0 left-0 outline-none"
          style={{
            transform: `translate(${String(live.x)}px, ${String(live.y)}px) scale(${String(live.scale)})`,
            transformOrigin: "0 0",
          }}
          data-slide-list
          data-focus-edge
          onKeyDown={onKey}
          onPointerDown={onCardGrab}
          onMouseDown={onCardPress}
          onClick={onCardClick}
          onDoubleClick={onCardDouble}
          onContextMenu={onCardMenu}
          onFocus={onCardFocus}
        >
          {bands.map((band, number) => {
            const first = layout.cards[band.start]
            if (first === undefined) return null
            const last = number === bands.length - 1
            return [
              <GridGroupFrame
                key={`frame:${first.id}`}
                number={number}
                box={{
                  left: 0,
                  top: band.top,
                  width: band.width,
                  height: band.bottom - band.top,
                }}
                hover={hover?.group === number ? hover.part : gripFocus === number ? "handle" : null}
                tint={tinted(number)}
                wrapped={band.wrapped}
                blocked={gripBlocked}
                grips={grips}
                onGrab={(event) => drag.grab(band.start, event, true)}
                onMove={(direction) => {
                  setHover(null)
                  const next = groups[number + (direction === "up" ? -1 : 1)]
                  const range = groups[number]
                  if (next === undefined || range === undefined) return
                  actions.moveSlides(gridIndices(range), direction === "up" ? next.start : next.end, "keep")
                }}
                onFocusGrip={(focused) => setGripFocus(focused ? number : null)}
              />,
              ...layout.cards.slice(band.start, band.end).map((card) => {
                const shift = drag.shift(card.index)
                return (
                  <GridCard
                    key={card.id}
                    card={card}
                    placement={placement}
                    count={count}
                    view={view}
                    painted={painted.has(card.index)}
                    current={card.index === current}
                    selected={selected.has(card.index)}
                    multiple={picked !== null}
                    reachable={card.index === reachable}
                    skipped={doom.propOf(view.nodes.get(card.id), "skipped") === true}
                    assetUrl={assetUrl}
                    lifted={held.has(card.index)}
                    shiftX={shift?.x ?? 0}
                    shiftY={shift?.y ?? 0}
                    still={drag.still}
                    tinted={tinted(number)}
                    wrapped={band.wrapped}
                    addGap={addBlocked ? null : spacing.column}
                    addEnd={card.index === band.end - 1}
                    previewFits={
                      card.index === band.end - 1 &&
                      inRoom(card.left + card.width + spacing.column, card.top, card.width, card.height)
                    }
                    onAdd={addAfter}
                  />
                )
              }),
              addBlocked ? null : (
                <GridGroupAdd
                  key={`add:${first.id}`}
                  group={number + 1}
                  left={0}
                  top={band.bottom}
                  width={first.width}
                  gap={spacing.group}
                  preview={{
                    top: spacing.group + spacing.inset,
                    height: first.height,
                    fits: inRoom(0, band.bottom + spacing.group + spacing.inset, first.width, first.height),
                  }}
                  last={last}
                  onAdd={() => actions.add(band.end - 1, "new")}
                />
              ),
            ]
          })}
          {dropBar === null ? null : (
            <div
              aria-hidden="true"
              data-drop-bar
              data-drop-place={dropBar.at + 1}
              data-group-drop={dropBar.group ? "" : undefined}
              style={
                dropBar.group
                  ? {
                      transform: `translate(${String(dropBar.rect.left)}px, calc(${String(dropBar.rect.top)}px - var(--grid-drop-bar) / ${String(scale)} / 2))`,
                      width: dropBar.rect.width,
                      height: `calc(var(--grid-drop-bar) / ${String(scale)})`,
                    }
                  : {
                      transform: `translate(calc(${String(dropBar.rect.left)}px - var(--grid-drop-bar) / ${String(scale)} / 2), ${String(dropBar.rect.top)}px)`,
                      width: `calc(var(--grid-drop-bar) / ${String(scale)})`,
                      height: dropBar.rect.height,
                    }
              }
            />
          )}
        </div>
        {box === null ? null : (
          <div
            aria-hidden="true"
            data-grid-marquee
            style={{
              transform: `translate(${String(live.x + box.left * scale)}px, ${String(live.y + box.top * scale)}px)`,
              width: (box.right - box.left) * scale,
              height: (box.bottom - box.top) * scale,
            }}
          />
        )}
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
        <SlideMenu
          open
          anchor={menu.anchor}
          pointer={menu.pointer}
          index={menu.index}
          count={count}
          onOpenChange={(next, keyboard) => {
            if (!next) actions.closeMenu(keyboard)
          }}
          onChoose={(change) => actions.act(change, menu.index)}
          skipped={strip.skipped?.[menu.index] === true}
          onSkip={strip.onSkip === undefined ? undefined : (skipped) => strip.onSkip?.(actions.menuHeld, skipped)}
          set={actions.menuSet}
          onOpen={() => onOpen(menu.index)}
        >
          {strip.onAdd === undefined
            ? null
            : (["same", "new"] as const).map((side) => (
                <DropdownMenuItem
                  key={side}
                  disabled={actions.full}
                  aria-description={actions.full ? slideListCopy.slideLimit(doom.limits.slides) : undefined}
                  className={slideMenuItem}
                  onClick={() => actions.add(menu.index, side)}
                >
                  {side === "same" ? slideListCopy.addAfterMenu : slideListCopy.addBelowMenu}
                </DropdownMenuItem>
              ))}
          {strip.onMoveGroups === undefined ? null : (
            <DropdownMenuItem disabled={!actions.canMoveBelow} className={slideMenuItem} onClick={actions.moveBelow}>
              {slideListCopy.moveBelowMenu}
            </DropdownMenuItem>
          )}
        </SlideMenu>
      )}
      <div className="flex shrink-0 justify-center pt-2 pb-6">{bar}</div>
    </div>
  )
}
