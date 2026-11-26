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
  type ReactNode,
} from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { Zoom } from "@/editing/canvas-zoom"
import { gestureFor } from "@/lib/gestures"
import { cn } from "@/lib/class-names"
import { GridHead, Island, type GridHeadProps } from "@/editor/editor-chrome"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gridMove } from "@/editor/editor-grid-keys"
import { GridCard } from "@/editor/grid-card"
import { gridOpened, gridPick, gridRinged, gridStep, type GridInteraction } from "@/editor/grid-interaction"
import { gridLayout, gridSpacing } from "@/editor/grid-lines"
import { marqueeStep, type MarqueeDeck } from "@/editor/grid-marquee"
import { pickAll, pickRange, pickToggle, prunedPick, toggledCurrent } from "@/editor/grid-selection"
import { gridShown, type GridView } from "@/editor/grid-viewport"
import { useGridCamera } from "@/editor/use-grid-camera"
import { useGridMarquee } from "@/editor/use-grid-marquee"

export type GridShownZoom = { readonly percent: number; readonly fit: boolean; readonly selection: boolean }

export type GridCommands = { readonly zoomTo: (zoom: Zoom) => void; readonly zoomSelection: () => void }

export type GridStart = { readonly picked?: readonly number[]; readonly camera?: GridView }

function opened(start: GridStart): GridInteraction {
  const first = start.picked?.[0]
  return first === undefined ? gridOpened : { kind: "slides", pick: { anchor: first, slides: new Set(start.picked) } }
}

const paintMargin = 200

function slideGroups(view: doom.Doom): readonly (readonly doom.NodeId[])[] {
  const rows = new Map<doom.NodeId | undefined, doom.NodeId[]>()
  for (const slide of doom.slidesOf(view)) {
    const row = doom.parentOf(slide)?.id
    rows.set(row, [...(rows.get(row) ?? []), slide.id])
  }
  return [...rows.values()]
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
  current,
  onCurrent,
  onOpen,
  hand,
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
  readonly current: number
  readonly onCurrent: (index: number) => void
  readonly onOpen: (index: number) => void
  readonly hand: boolean
  readonly head: Omit<GridHeadProps, "selected">
  readonly right: ReactNode
  readonly bar: ReactNode
  readonly assetUrl: (asset: string) => string | undefined
  readonly onShown: (shown: GridShownZoom) => void
  readonly onCommands: (commands: GridCommands | null) => void
  readonly start?: GridStart
}) {
  const { size } = doom.deckOf(view)
  const layout = useMemo(() => gridLayout(slideGroups(view), { width: size.w, height: size.h }), [view, size.w, size.h])
  const count = layout.cards.length
  const [state, dispatch] = useReducer(gridStep, start, opened)
  const picked = prunedPick(gridPick(state), count)
  const ringed = gridRinged(state, current, count)
  const camera = useGridCamera({
    deck,
    layout,
    ringed,
    hand,
    ...(start.camera === undefined ? {} : { start: start.camera }),
  })
  const scale = camera.view.scale
  const painted = new Set(gridShown(layout, camera.view, camera.room, paintMargin))
  const list = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const quiet = useRef(false)
  const chosen = useRef<number | null>(null)
  const [stop, setStop] = useState(current)
  const [message, setMessage] = useState<Announcement | null>(null)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  const deckOf: MarqueeDeck = { current, count }

  function focusCard(index: number, reveal: boolean) {
    quiet.current = !reveal
    list.current
      ?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
      ?.focus({ preventScroll: true })
    quiet.current = false
  }

  function choose(index: number) {
    chosen.current = index
    onCurrent(index)
  }

  function pickedNow(next: GridInteraction) {
    if (next.kind === "none") {
      announce(slideListCopy.nothingSelected)
      return
    }
    const now = toggledCurrent(next.pick, current)
    if (now !== current) choose(now)
    focusCard(now, false)
    announce(slideListCopy.selected(gridRinged(next, now, count).length))
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
    const next = shift ? pickRange(picked, index, current) : pickToggle(picked, index, current)
    dispatch({ kind: "pick", pick: next })
    if (next !== null) announce(slideListCopy.selected(next.slides.size))
    choose(toggledCurrent(next, index))
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

  const percent = Math.round(scale * 100)
  const selection = ringed.length > 0
  useLayoutEffect(() => onShown({ percent, fit: camera.fit, selection }), [onShown, percent, camera.fit, selection])

  useLayoutEffect(() => {
    onCommands({ zoomTo: (zoom) => camera.zoomTo(zoom, ringed[0]), zoomSelection: camera.zoomSelection })
  })
  useLayoutEffect(() => () => onCommands(null), [onCommands])

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!editorOwnsKey(event)) return
    const gesture = gestureFor(event.nativeEvent, "grid")
    const index = entryOf(event.target)
    if (gesture === "select-all") {
      event.preventDefault()
      const all = pickAll(count, current)
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
    if (gesture === "slide-open") {
      event.preventDefault()
      onOpen(index)
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const to = gridMove(event.key, layout.cards, index)
    if (to === null) return
    event.preventDefault()
    focusCard(to, true)
    if (event.shiftKey) {
      const next = pickRange(picked, to, current)
      dispatch({ kind: "pick", pick: next })
      if (next !== null) announce(slideListCopy.selected(next.slides.size))
    } else dispatch({ kind: "pick", pick: null })
    choose(to)
  }

  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index !== null) pick(index, event.shiftKey, event.metaKey || event.ctrlKey)
  }

  function onCardDouble(event: MouseEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index !== null && !event.shiftKey && !event.metaKey && !event.ctrlKey) onOpen(index)
  }

  function onCardFocus(event: FocusEvent<HTMLDivElement>) {
    const index = entryOf(event.target)
    if (index === null) return
    setStop(index)
    if (!quiet.current) camera.reveal(index)
  }

  const spacing = gridSpacing({ width: size.w, height: size.h })
  const selected = new Set(ringed)
  const box = marquee.box
  const reachable = stop < count ? stop : current
  return (
    <div ref={root} className="flex h-full min-w-0 flex-1 flex-col bg-canvas" data-editor-grid data-grid-view>
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
        onClick={(event) => {
          if (marquee.swallowedClick()) return
          if (entryOf(event.target) === null) clear()
        }}
        data-grid-viewport
        data-marquee={box === null ? undefined : ""}
        data-focus-edge
      >
        <div
          ref={list}
          tabIndex={-1}
          role="group"
          aria-label={slideListCopy.listName}
          className="absolute top-0 left-0 outline-none"
          style={{ transform: `translate(${String(camera.view.x)}px, ${String(camera.view.y)}px)` }}
          data-slide-list
          data-focus-edge
          onKeyDown={onKey}
          onClick={onCardClick}
          onDoubleClick={onCardDouble}
          onFocus={onCardFocus}
        >
          {layout.cards.map((card) => (
            <GridCard
              key={card.id}
              card={card}
              scale={scale}
              gap={spacing.group}
              count={count}
              view={view}
              painted={painted.has(card.index)}
              current={card.index === current}
              selected={selected.has(card.index)}
              multiple={picked !== null}
              reachable={card.index === reachable}
              skipped={doom.propOf(view.nodes.get(card.id), "skipped") === true}
              assetUrl={assetUrl}
            />
          ))}
        </div>
        {box === null ? null : (
          <div
            aria-hidden="true"
            data-grid-marquee
            style={{
              transform: `translate(${String(camera.view.x + box.left * scale)}px, ${String(camera.view.y + box.top * scale)}px)`,
              width: (box.right - box.left) * scale,
              height: (box.bottom - box.top) * scale,
            }}
          />
        )}
      </div>
      <div className="flex shrink-0 justify-center pt-2 pb-6">{bar}</div>
    </div>
  )
}
