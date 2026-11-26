import * as doom from "@airdesign/doom"
import { useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from "react"
import { flushSync } from "react-dom"
import { slideListCopy } from "@/copy/slide-list-copy"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { elementAt, gridEntryOf, gridRoute } from "@/editor/grid-hit"
import { gridEditing, gridStep, type GridInteraction, type GridStep } from "@/editor/grid-interaction"
import type { GridLayout, GridRect } from "@/editor/grid-lines"
import { gridElementPresses } from "@/editor/grid-number"
import { noSelection, type Selection } from "@/editor/selection"
import { aroundPlaced, type SlideGeometry } from "@/editor/slide-geometry"
import { gestureFor } from "@/lib/gestures"
import type { CanvasHandoff } from "./canvas"
import { typing } from "./use-canvas-keys"

export type GridElementFrame = { readonly index: number; readonly bounds: GridRect }

export function useGridEditing({
  list,
  state,
  dispatch,
  current,
  layout,
  line,
  view,
  selected,
  onCurrent,
  onSelection,
  announce,
}: {
  readonly list: RefObject<HTMLDivElement | null>
  readonly state: GridInteraction
  readonly dispatch: (step: GridStep) => void
  readonly current: number
  readonly layout: GridLayout
  readonly line: number
  readonly view: doom.Doom
  readonly selected: readonly doom.NodeId[]
  readonly onCurrent: (index: number) => void
  readonly onSelection: (next: Selection) => void
  readonly announce: (text: string) => void
}) {
  const handoff = useRef<CanvasHandoff | null>(null)
  const geometries = useRef(new Map<doom.NodeId, SlideGeometry>())
  const swallow = useRef(false)
  const scaleNow = useRef<() => number>(() => 1)
  const handNow = useRef(false)
  const spaceNow = useRef(false)
  const slideAt = useRef<
    (
      index: number,
      client: { readonly x: number; readonly y: number },
    ) => { readonly x: number; readonly y: number } | null
  >(() => null)
  const onGeometry = useCallback((slide: doom.NodeId, geometry: SlideGeometry | null) => {
    if (geometry === null) geometries.current.delete(slide)
    else geometries.current.set(slide, geometry)
  }, [])
  const editing = gridEditing(state)

  function step(next: GridStep) {
    if (!gridEditing(gridStep(state, next))) onSelection(noSelection)
    dispatch(next)
  }

  function entry(index: number) {
    return list.current?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`) ?? null
  }

  function layerAt(index: number, id: doom.NodeId, scale: number, event: PointerEvent<HTMLDivElement>): boolean {
    const geometry = geometries.current.get(id)
    const at = slideAt.current(index, { x: event.clientX, y: event.clientY })
    if (geometry === undefined || at === null) return false
    return elementAt(geometry, at, 4.5 / scale, (node) => doom.lockedIn(view, node)) !== null
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    swallow.current = false
    if (event.button !== 0 || handNow.current || spaceNow.current) return
    const target = event.target
    if (!(target instanceof Element)) return
    const index = gridEntryOf(target)
    const card = index === null ? undefined : layout.cards[index]
    const scale = scaleNow.current()
    const part =
      target.closest("[data-slide-number]") !== null
        ? "number"
        : target.closest("[data-grid-edit]") !== null
          ? "live"
          : "picture"
    const editable =
      card !== undefined &&
      index !== null &&
      scale > 0 &&
      gridElementPresses({ width: card.width * scale, gap: line * scale })
    const element =
      part === "picture" &&
      card !== undefined &&
      index !== null &&
      scale > 0 &&
      gridElementPresses({ width: card.width * scale, gap: line * scale }) &&
      layerAt(index, card.id, scale, event)
    const route = gridRoute(part, element, !editable)
    if (route === "canvas") return
    if (route !== "edit") {
      if (part === "live" && index !== null) {
        event.preventDefault()
        event.stopPropagation()
        flushSync(() => {
          if (index !== current) onCurrent(index)
          step({ kind: "pick", pick: null })
        })
        entry(index)?.focus({ preventScroll: true })
      }
      return
    }
    if (card === undefined || index === null) return
    swallow.current = true
    flushSync(() => {
      if (index !== current) onCurrent(index)
      dispatch({ kind: "enter", slide: card.id })
    })
    handoff.current?.down(event)
    list.current?.querySelector<HTMLElement>("[data-grid-edit]")?.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    requestAnimationFrame(() => {
      swallow.current = false
    })
  }

  function open(index: number) {
    const card = layout.cards[index]
    if (card === undefined) return
    flushSync(() => {
      if (index !== current) onCurrent(index)
      dispatch({ kind: "enter", slide: card.id })
    })
    list.current?.querySelector<HTMLElement>("[data-grid-edit]")?.focus({ preventScroll: true })
    announce(slideListCopy.entered(index + 1))
  }

  function swallowed(event: MouseEvent<HTMLDivElement>): boolean {
    if (!swallow.current || event.detail === 0) return false
    swallow.current = false
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  function editOrOpen(event: MouseEvent<HTMLDivElement>, onOpen: (index: number) => void) {
    if (event.shiftKey || event.metaKey || event.ctrlKey) return
    const index = gridEntryOf(event.target)
    if (event.target instanceof Element && event.target.closest("[data-grid-edit]") !== null) return
    if (index !== null && !(editing && index === current)) {
      onOpen(index)
      return
    }
    if (editing) handoff.current?.editAt(event)
  }

  function escape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || !editorOwnsKey(event)) return
    if (gestureFor(event.nativeEvent, "grid") !== "deselect") return
    if (handoff.current?.cancel() === true) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (typing(event.target) || state.kind === "text" || state.kind === "none") return
    event.preventDefault()
    event.stopPropagation()
    if (state.kind === "elements") {
      flushSync(() => step({ kind: "escape" }))
      entry(current)?.focus({ preventScroll: true, focusVisible: true })
      announce(slideListCopy.selected(1))
      return
    }
    step({ kind: "escape" })
    list.current?.focus({ preventScroll: true, focusVisible: true })
    announce(slideListCopy.nothingSelected)
  }

  function land(slide: doom.NodeId, ids: readonly doom.NodeId[]) {
    const index = layout.cards.findIndex((card) => card.id === slide)
    flushSync(() => {
      if (index >= 0 && index !== current) onCurrent(index)
      dispatch({ kind: "enter", slide })
    })
    onSelection({ ids, inside: null })
    list.current?.querySelector<HTMLElement>("[data-grid-edit]")?.focus({ preventScroll: true })
  }

  function blank() {
    flushSync(() => step({ kind: "pick", pick: null }))
    const chosen = entry(current)
    chosen?.focus({ preventScroll: true })
    requestAnimationFrame(() => chosen?.focus({ preventScroll: true }))
  }

  const shown = useRef<string | undefined>(undefined)
  shown.current = layout.cards[current]?.id

  function sessionSlide(): string | undefined {
    return state.kind === "elements" || state.kind === "text" ? state.slide : shown.current
  }

  function mode(next: "elements" | "text") {
    const slide = sessionSlide()
    if (slide === undefined) return
    const step: GridStep = next === "text" ? { kind: "type", slide } : { kind: "enter", slide }
    if (gridStep(state, step) !== state) dispatch(step)
  }

  const begin = useCallback(() => {
    const slide = shown.current
    if (slide !== undefined) dispatch({ kind: "enter", slide })
  }, [dispatch])

  const liveId = state.kind === "elements" || state.kind === "text" ? state.slide : undefined
  const card = liveId === undefined ? layout.cards[current] : layout.cards.find((item) => item.id === liveId)
  const geometry = card === undefined || !editing ? undefined : geometries.current.get(card.id)
  const bounds = geometry === undefined ? null : aroundPlaced(selected.flatMap((id) => geometry.byId.get(id) ?? []))
  const frame: GridElementFrame | null =
    bounds === null || bounds.right <= bounds.left || bounds.bottom <= bounds.top
      ? null
      : {
          index: card?.index ?? current,
          bounds: {
            left: bounds.left,
            top: bounds.top,
            width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top,
          },
        }

  return {
    editing,
    frame,
    handoff,
    geometries,
    land,
    scaleNow,
    handNow,
    spaceNow,
    slideAt,
    onGeometry,
    step,
    press,
    open,
    swallowed,
    editOrOpen,
    escape,
    blank,
    mode,
    begin,
    inLive: (target: EventTarget | null) => target instanceof Element && target.closest("[data-grid-edit]") !== null,
  }
}
