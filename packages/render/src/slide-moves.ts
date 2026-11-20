import type { Box, ElementId, StackMove } from "@airdesign/document"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"
import { handleArrangeKey, type Grouping } from "./arrange-keys.js"
import { boxOf, nudgedBoxes, sameBox, type Moved, type Nudge } from "./box-gesture.js"
import { snapTargets } from "./drag-snap.js"
import { gestureFor, releases } from "./gestures.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import { editingText, enterText } from "./text-entry.js"
import {
  alone,
  childrenSelection,
  deepPicked,
  deepToggled,
  focused,
  kept,
  leadOf,
  noSelection,
  parentSelection,
  sameSelection,
  keyedSelection,
  siblingSelection,
  steppedIn,
  toggled,
  unitOf,
  type Selection,
} from "./selection.js"
import { guideBoard, type GuideBoard } from "./guide-layer.js"
import { rotationGrips } from "./rotation-grips.js"
import type { BoxGrip, PaintStore } from "./store.js"
import {
  finishedTurns,
  flipsBy,
  modifiersOf,
  pointerDragOf,
  watchPointerDrag,
  type DragAfter,
  type PointerDrag,
  type TransformActions,
  type TransformModifiers,
} from "./transform-drag.js"
import { hudChannel, type HudChannel } from "./transform-hud.js"
import { isRotateGrip, resizedByKey, type TransformGrip } from "./transform-math.js"
import type { OwnsKey } from "./use-slide-marquee.js"

export type { Grouping } from "./arrange-keys.js"

export type Picking = {
  readonly selection?: Selection
  readonly onSelection?: (selection: Selection) => void
  readonly ownsKey?: OwnsKey
  readonly onEmptyPress?: (event: PointerEvent<HTMLDivElement>) => void
  readonly onBackdropMarquee?: (event: PointerEvent<HTMLElement>, owner: CanvasElement) => void
  readonly onDragChange?: (dragging: boolean) => void
}

type ActiveHold = PointerDrag | Nudge

export type Moves = {
  readonly selection: Selection
  readonly guides: GuideBoard
  readonly latest: RefObject<Selection>
  readonly choose: (next: Selection) => void
  readonly isDragging: () => boolean
  readonly hud: HudChannel
  readonly message: string
  readonly say: (message: string) => void
  readonly select: (id: ElementId) => void
  readonly press: (event: PointerEvent<HTMLElement>, element: CanvasElement, grip: TransformGrip) => void
  readonly doubleClick: (event: MouseEvent<HTMLElement>, element: CanvasElement) => void
  readonly key: (event: KeyboardEvent<HTMLElement>, element: CanvasElement) => void
  readonly slide: {
    readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
    readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void
    readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void
    readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
    readonly onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void
  }
}

const slidePaint = "[data-slide-paint]"
const keepsSelection = "[data-keeps-selection]"

export function canMove(element: CanvasElement): boolean {
  return element.id !== null && element.movable === true && element.box !== null
}

export function canDrag(element: CanvasElement): boolean {
  return canMove(element) && element.connection === undefined
}

function frameOf(from: HTMLElement, element: CanvasElement): HTMLElement | null {
  return from.closest(slidePaint)?.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`) ?? null
}

export function useMoves(
  store: PaintStore,
  size: CanvasSlide,
  width: number,
  onBoxes: ((moved: readonly Moved[]) => void) | undefined,
  onRemove?: (ids: readonly ElementId[]) => void,
  onOrder?: (id: ElementId, move: StackMove) => void,
  picking?: Picking,
  grouping?: Grouping,
  transforms?: TransformActions,
): Moves {
  const [own, setOwn] = useState<Selection>(noSelection)
  const given = picking?.selection ?? own
  const selection = kept(given, size)
  const latest = useRef(selection)
  const onSelection = picking?.onSelection
  useLayoutEffect(() => {
    latest.current = selection
    if (selection === given) return
    setOwn(selection)
    onSelection?.(selection)
  }, [given, selection, onSelection])
  const [message, setMessage] = useState("")
  const [guides] = useState(guideBoard)
  const [hud] = useState(hudChannel)
  const keyed = useRef({ verb: "", label: "" })
  const held = useRef<ActiveHold | null>(null)
  const grips = useRef(new Map<ElementId, BoxGrip>())
  const [turning] = useState(rotationGrips)
  const cancelling = useRef<(() => void) | null>(null)
  const pressedFrame = useRef<HTMLElement | null>(null)
  useEffect(() => () => letGo([]), [])
  useLayoutEffect(() => {
    const now = held.current
    if (now === null) return
    const shown = now.ids.filter((id) => size.elements.some((each) => each.id === id))
    if (shown.length === now.ids.length) return
    for (const id of now.ids.filter((each) => !shown.includes(each))) {
      grips.current.get(id)?.release()
      grips.current.delete(id)
      turning.drop(id)
    }
    const starts = new Map([...now.starts].filter(([id]) => shown.includes(id)))
    if (now.by === "pointer") {
      const layers = new Map([...now.layers].filter(([id]) => shown.includes(id)))
      held.current = { ...now, ids: shown, starts, layers }
    } else {
      held.current = { ...now, ids: shown, starts }
    }
  }, [size])

  function elementOf(id: ElementId | null | undefined): CanvasElement | undefined {
    return id === undefined || id === null ? undefined : size.elements.find((each) => each.id === id)
  }

  function choose(next: Selection) {
    if (sameSelection(next, latest.current)) return
    latest.current = next
    setOwn(next)
    onSelection?.(next)
  }

  function entered(done: PointerDrag) {
    const child = elementOf(done.enter)
    const frame = pressedFrame.current
    if (child?.id === undefined || child.id === null || frame === null) return
    choose(alone(size, child.id))
    frameOf(frame, child)?.focus()
  }

  function startOf(element: CanvasElement): Box | null {
    if (element.id === null) return null
    return store.getBox(element.id) ?? (element.box === null ? null : boxOf(element.box))
  }

  function hold(next: ActiveHold) {
    held.current = next
    grips.current = new Map(next.ids.map((id) => [id, store.gripBox(id)]))
    turning.grip(store, next.by === "pointer" && isRotateGrip(next.grip) ? next.ids : [])
    picking?.onDragChange?.(true)
  }

  function place(boxes: ReadonlyMap<ElementId, Box>) {
    for (const [id, box] of boxes) grips.current.get(id)?.place(box)
  }

  function letGo(changed: readonly ElementId[]) {
    const wasHeld = held.current !== null
    held.current = null
    guides.show([])
    hud.write(null)
    for (const [id, grip] of grips.current) {
      if (changed.includes(id)) grip.keep()
      else grip.release()
    }
    turning.end(changed)
    grips.current = new Map()
    if (wasHeld) picking?.onDragChange?.(false)
  }

  function finish(done: ActiveHold) {
    if (done.by === "pointer" && isRotateGrip(done.grip)) {
      const turned = finishedTurns(done.layers, store)
      letGo(turned.map((each) => each.id))
      if (turned.length > 0) transforms?.onRotate?.(turned)
      return
    }
    const moved = done.ids.flatMap((id): Moved[] => {
      const box = store.getBox(id)
      const start = done.starts.get(id)
      return box === null || start === undefined || sameBox(box, start) ? [] : [{ id, box }]
    })
    letGo(moved.map((each) => each.id))
    if (moved.length > 0) onBoxes?.(moved)
  }

  function startsOf(ids: readonly ElementId[]): ReadonlyMap<ElementId, Box> {
    return new Map(
      ids.flatMap((id): [ElementId, Box][] => {
        const element = elementOf(id)
        const start = element === undefined || !canDrag(element) ? null : startOf(element)
        return start === null ? [] : [[id, start]]
      }),
    )
  }

  function movingWith(id: ElementId): readonly ElementId[] {
    const ids = latest.current.ids
    return ids.length > 1 && ids.includes(id) ? [id, ...ids.filter((each) => each !== id)] : [id]
  }

  function follow(pressed: PointerDrag, document: Document, initialModifiers: TransformModifiers) {
    hold(pressed)
    cancelling.current = watchPointerDrag({
      document,
      pointer: pressed.pointer,
      from: pressed.from,
      initialModifiers,
      width,
      slide: size,
      snap: snapTargets(size, store, pressed.ids),
      current: () => (held.current?.by === "pointer" ? held.current : null),
      markMoved: (now) => {
        const active = { ...now, moved: true }
        held.current = active
        return active
      },
      applyResult: (result) => {
        place(result.boxes)
        for (const [id, rotation] of result.rotations) turning.place(id, rotation)
        guides.show(result.guides)
        hud.write(result.hud)
      },
      onFinish: (now) => {
        finish(now)
        if (now.moved) return
        if (now.toggleOnClick !== undefined) {
          const next = toggled(size, latest.current, now.toggleOnClick)
          choose(next)
          if (pressedFrame.current !== null) focusSelection(pressedFrame.current, next)
          return
        }
        if (now.enter !== undefined) entered(now)
        else if (now.grip === "move" && now.ids.length > 1 && now.ids[0] !== undefined) choose(alone(size, now.ids[0]))
      },
      onCancel: () => letGo([]),
      onStop: () => {
        cancelling.current = null
      },
    })
  }

  function pressOn(
    event: PointerEvent<HTMLElement>,
    element: CanvasElement,
    grip: TransformGrip,
    enter?: ElementId,
    toggleOnClick?: ElementId,
  ) {
    const id = element.id
    if (id === null) return
    const frame = frameOf(event.currentTarget, element)
    if (frame === null || (grip === "move" && editingText(event.target, frame))) return
    event.preventDefault()
    pressedFrame.current = frame
    frame.focus()
    const ids = movingWith(id)
    if (ids.length === 1) choose(alone(size, id))
    dragFrom(event, frame, ids, grip, {
      ...(enter === undefined ? {} : { enter }),
      ...(toggleOnClick === undefined ? {} : { toggleOnClick }),
    })
  }

  function dragFrom(
    event: PointerEvent<HTMLElement>,
    frame: HTMLElement,
    ids: readonly ElementId[],
    grip: TransformGrip,
    after: DragAfter,
  ) {
    const surface = frame.closest<HTMLElement>(slidePaint)
    const drag = pointerDragOf(event, { surface, slide: size, store, width }, startsOf(ids), ids, grip, after)
    if (drag !== null) follow(drag, frame.ownerDocument, modifiersOf(event))
  }

  function focusSelection(from: HTMLElement, next: Selection) {
    const lead = elementOf(leadOf(next))
    const frame = lead === undefined ? null : frameOf(from, lead)
    if (frame !== null) frame.focus({ preventScroll: true })
    else from.closest<HTMLElement>(slidePaint)?.focus({ preventScroll: true })
  }

  function deepPress(event: PointerEvent<HTMLElement>, element: CanvasElement) {
    const id = element.id
    if (id === null) return
    const frame = frameOf(event.currentTarget, element)
    if (frame === null) return
    event.preventDefault()
    pressedFrame.current = frame
    choose(deepPicked(size, id))
    frame.focus()
    dragFrom(event, frame, [id], "move", {})
  }

  function chooseOn(event: PointerEvent<HTMLElement>, element: CanvasElement, deep: boolean) {
    if (element.id === null) return
    event.preventDefault()
    const next = deep ? deepToggled(size, latest.current, element.id) : toggled(size, latest.current, element.id)
    choose(next)
    focusSelection(event.currentTarget, next)
  }

  function press(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: TransformGrip) {
    const id = element.id
    if (id === null || event.button !== 0 || held.current !== null) return
    const mod = event.metaKey || event.ctrlKey
    if (grip === "move" && element.backdrop === true) {
      const owner = elementOf(element.group?.id)
      if (owner === undefined) return
      if (mod && !event.shiftKey && picking?.onBackdropMarquee !== undefined) {
        picking.onBackdropMarquee(event, owner)
        return
      }
      if (event.shiftKey) chooseOn(event, owner, false)
      else pressOn(event, owner, "move")
      return
    }
    if (grip === "move" && event.shiftKey) {
      const unitId = unitOf(size, latest.current, id)
      const chosen = latest.current.ids.includes(id) || (unitId !== null && latest.current.ids.includes(unitId))
      if (chosen && !mod)
        pressOn(event, unitId === null ? element : (elementOf(unitId) ?? element), "move", undefined, id)
      else chooseOn(event, element, mod)
      return
    }
    if (grip === "move" && mod) {
      deepPress(event, element)
      return
    }
    const unit = grip === "move" ? elementOf(unitOf(size, latest.current, id)) : undefined
    if (unit?.id === undefined || unit.id === null || unit.id === id) {
      pressOn(event, element, grip)
      return
    }
    pressOn(event, unit, "move")
  }

  function doubleClick(event: MouseEvent<HTMLElement>, element: CanvasElement) {
    const id = element.id
    if (id === null || event.shiftKey || event.metaKey || event.ctrlKey || held.current !== null) return
    const next = steppedIn(size, latest.current, id)
    if (next !== null) {
      event.preventDefault()
      event.stopPropagation()
      choose(next)
      focusSelection(event.currentTarget, next)
      return
    }
    const frame = frameOf(event.currentTarget, element)
    const chosen = latest.current.ids
    if (!element.editable || frame === null || chosen.length !== 1 || chosen[0] !== id) return
    if (editingText(event.target, frame)) return
    if (enterText(frame, { x: event.clientX, y: event.clientY })) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function owns(event: KeyboardEvent<HTMLElement>): boolean {
    return picking?.ownsKey === undefined || picking.ownsKey(event)
  }

  function key(event: KeyboardEvent<HTMLElement>, element: CanvasElement) {
    const id = element.id
    if (id === null || event.nativeEvent.isComposing) return
    const frame = event.currentTarget
    const onFrame = event.target === frame
    const gesture = gestureFor(event, onFrame ? "element" : "text")
    if (gesture === "deselect") {
      event.preventDefault()
      const cancel = cancelling.current
      if (cancel !== null) cancel()
      else if (!onFrame) frame.focus()
      else {
        const parent = parentSelection(size, latest.current)
        if (parent === null) frame.closest<HTMLElement>(slidePaint)?.focus()
        else if (owns(event)) {
          choose(parent)
          focusSelection(frame, parent)
        }
      }
      return
    }
    if (!onFrame) return
    const now = held.current
    if (gesture === "select-parent") {
      if (now !== null) return
      const parent = parentSelection(size, latest.current)
      if (parent !== null && owns(event)) {
        event.preventDefault()
        choose(parent)
        focusSelection(frame, parent)
      }
      return
    }
    if (gesture === "select-next" || gesture === "select-all" || gesture === "select-inverse") {
      if (now !== null) return
      const next =
        keyedSelection(size, latest.current, gesture) ?? siblingSelection(size, latest.current, event.shiftKey ? -1 : 1)
      if (next !== null && owns(event)) {
        event.preventDefault()
        choose(next)
        focusSelection(frame, next)
      }
      return
    }
    if (gesture === "flip-horizontal" || gesture === "flip-vertical") {
      const flips = now === null ? flipsBy(size, store, movingWith(id), gesture) : []
      if (flips.length === 0 || transforms?.onFlip === undefined) return
      event.preventDefault()
      transforms.onFlip(flips)
      return
    }
    if (now === null && handleArrangeKey(event, gesture, element, id, latest.current.ids, grouping, onOrder)) return
    if (gesture === "edit-text") {
      if (now !== null) return
      const children = childrenSelection(size, latest.current)
      if (children !== null) {
        if (!owns(event)) return
        event.preventDefault()
        choose(children)
        focusSelection(frame, children)
        return
      }
      if (enterText(frame)) event.preventDefault()
      return
    }
    if (gesture === "delete" && now === null) {
      const ids = latest.current.ids
      const removable = (ids.includes(id) ? ids : [id]).filter((each) => {
        const found = elementOf(each)
        return found !== undefined && canMove(found)
      })
      if (onRemove === undefined || removable.length === 0) return
      event.preventDefault()
      onRemove(removable)
      return
    }
    if (now?.by === "pointer") return
    const ids = now?.by === "keys" ? now.ids : movingWith(id)
    if (gesture === "resize-keys") {
      const start = startOf(element)
      if (ids.length > 1 || start === null || !canDrag(element)) return
      const grown = resizedByKey(start, event.key, element.box?.rotation ?? 0)
      if (grown === null) return
      event.preventDefault()
      if (now === null) hold({ by: "keys", ids, starts: new Map([[id, start]]) })
      keyed.current = { verb: "Resized", label: frame.getAttribute("aria-label") ?? "" }
      place(new Map([[id, grown]]))
      return
    }
    if (gesture !== "nudge" && gesture !== "nudge-far") return
    const starts = startsOf(ids)
    const next = nudgedBoxes(starts, event.key, gesture === "nudge-far", size)
    if (next === null || starts.size === 0) return
    event.preventDefault()
    if (now === null) hold({ by: "keys", ids: [...starts.keys()], starts })
    const label = starts.size > 1 ? `${String(starts.size)} layers` : (frame.getAttribute("aria-label") ?? "")
    keyed.current = { verb: "Moved", label }
    place(next)
  }

  const slide = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || event.button !== 0) return
      if (picking?.onEmptyPress !== undefined) {
        picking.onEmptyPress(event)
        return
      }
      event.preventDefault()
      event.currentTarget.focus()
    },
    onFocus(event: FocusEvent<HTMLDivElement>) {
      if (event.target === event.currentTarget) choose(noSelection)
    },
    onBlur(event: FocusEvent<HTMLDivElement>) {
      const now = held.current
      if (now?.by === "keys") finish(now)
      const next = event.relatedTarget
      if (next instanceof Element && next.closest(keepsSelection) !== null) return
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) choose(noSelection)
    },
    onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      const next = keyedSelection(size, noSelection, gestureFor(event, "slide"))
      if (event.target !== event.currentTarget || next === null || next.ids.length === 0 || !owns(event)) return
      event.preventDefault()
      choose(next)
      focusSelection(event.currentTarget, next)
    },
    onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
      const now = held.current
      if (now?.by === "keys" && releases(event, "nudge")) {
        finish(now)
        setMessage(`${keyed.current.verb} ${keyed.current.label}`)
      }
    },
  }

  function select(id: ElementId) {
    choose(focused(size, latest.current, id))
  }

  return {
    selection,
    guides,
    latest,
    choose,
    isDragging: () => held.current !== null,
    hud,
    message,
    say: setMessage,
    select,
    press,
    doubleClick,
    key,
    slide,
  }
}
