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
import {
  boxOf,
  isArrow,
  nudgedBoxes,
  resizedByKey,
  sameBox,
  travelled,
  type Drag,
  type Grip,
  type Held,
  type Moved,
  type Point,
} from "./box-gesture.js"
import { snappedDrag, snapTargets } from "./drag-snap.js"
import { gestureFor } from "./gestures.js"
import { typeHeld } from "./held-keys.js"
import { oncePerFrame } from "./once-per-frame.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
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
  siblingSelection,
  steppedIn,
  toggled,
  unitOf,
  type Selection,
} from "./selection.js"
import { guideBoard, type GuideBoard } from "./guide-layer.js"
import type { BoxGrip, PaintStore } from "./store.js"
import type { OwnsKey } from "./use-slide-marquee.js"

export type Grouping = {
  readonly onFrame?: (ids: readonly ElementId[]) => void
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
}

export type Picking = {
  readonly selection?: Selection
  readonly onSelection?: (selection: Selection) => void
  readonly ownsKey?: OwnsKey
  readonly onEmptyPress?: (event: PointerEvent<HTMLDivElement>) => void
  readonly onBackdropMarquee?: (event: PointerEvent<HTMLElement>, owner: CanvasElement) => void
  readonly onDragChange?: (dragging: boolean) => void
}

export type Moves = {
  readonly selection: Selection
  readonly guides: GuideBoard
  readonly latest: RefObject<Selection>
  readonly choose: (next: Selection) => void
  readonly isDragging: () => boolean
  readonly message: string
  readonly say: (message: string) => void
  readonly select: (id: ElementId) => void
  readonly press: (event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) => void
  readonly doubleClick: (event: MouseEvent<HTMLElement>, element: CanvasElement) => void
  readonly key: (event: KeyboardEvent<HTMLElement>, element: CanvasElement) => void
  readonly slide: {
    readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
    readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void
    readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void
    readonly onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void
  }
}

const editableText = '[contenteditable="true"]'
const slidePaint = "[data-slide-paint]"
const keepsSelection = "[data-keeps-selection]"

export function canMove(element: CanvasElement): boolean {
  return element.id !== null && element.movable === true && element.box !== null
}

export function canDrag(element: CanvasElement): boolean {
  return canMove(element) && element.connection === undefined
}

function inText(target: EventTarget, frame: HTMLElement): boolean {
  const text = target instanceof Element ? target.closest(editableText) : null
  return text !== null && frame.contains(text)
}

function frameOf(from: HTMLElement, element: CanvasElement): HTMLElement | null {
  return from.closest(slidePaint)?.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`) ?? null
}

function enterText(frame: HTMLElement): boolean {
  const text = frame.querySelector<HTMLElement>(editableText)
  if (text === null) return false
  text.focus()
  const range = text.ownerDocument.createRange()
  range.selectNodeContents(text)
  range.collapse(false)
  const caret = text.ownerDocument.getSelection()
  caret?.removeAllRanges()
  caret?.addRange(range)
  return true
}

export function enterElement(slide: HTMLElement, element: CanvasElement, typed: string): void {
  const frame = slide.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`)
  if (frame === null) return
  if (enterText(frame)) typeHeld(slide.ownerDocument, typed)
  else frame.focus()
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
  const keyed = useRef({ verb: "", label: "" })
  const held = useRef<Held | null>(null)
  const grips = useRef(new Map<ElementId, BoxGrip>())
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
    }
    const starts = new Map([...now.starts].filter(([id]) => shown.includes(id)))
    held.current = { ...now, ids: shown, starts }
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

  function entered(done: Drag) {
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

  function hold(next: Held) {
    held.current = next
    grips.current = new Map(next.ids.map((id) => [id, store.gripBox(id)]))
    picking?.onDragChange?.(true)
  }

  function place(boxes: ReadonlyMap<ElementId, Box>) {
    for (const [id, box] of boxes) grips.current.get(id)?.place(box)
  }

  function letGo(changed: readonly ElementId[]) {
    const wasHeld = held.current !== null
    held.current = null
    guides.show([])
    for (const [id, grip] of grips.current) {
      if (changed.includes(id)) grip.keep()
      else grip.release()
    }
    grips.current = new Map()
    if (wasHeld) picking?.onDragChange?.(false)
  }

  function finish(done: Held) {
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

  function follow(pressed: Drag, document: Document) {
    const snap = snapTargets(size, store, pressed.ids)
    const moving = oncePerFrame(({ at, free }: { readonly at: Point; readonly free: boolean }) => {
      const now = held.current
      if (now?.by !== "pointer") return
      const snapped = snappedDrag(now, at, width, size, free ? null : snap)
      guides.show(snapped.guides)
      place(snapped.boxes)
    })
    function move(event: globalThis.PointerEvent) {
      const now = held.current
      if (now?.by !== "pointer" || event.pointerId !== now.pointer) return
      const at = { x: event.clientX, y: event.clientY }
      if (!now.moved && !travelled(now.from, at)) return
      held.current = { ...now, moved: true }
      moving.push({ at, free: event.ctrlKey })
    }
    function stop() {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", end)
      document.removeEventListener("pointercancel", lost)
      cancelling.current = null
    }
    function cancel() {
      moving.drop()
      stop()
      letGo([])
    }
    function end(event: globalThis.PointerEvent) {
      if (event.pointerId !== pressed.pointer) return
      moving.flush()
      stop()
      const now = held.current
      if (now !== null) finish(now)
      if (now?.by !== "pointer" || now.moved) return
      if (now.enter !== undefined) entered(now)
      else if (now.ids.length > 1 && now.ids[0] !== undefined) choose(alone(size, now.ids[0]))
    }
    function lost(event: globalThis.PointerEvent) {
      if (event.pointerId === pressed.pointer) cancel()
    }
    hold(pressed)
    cancelling.current = cancel
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", end)
    document.addEventListener("pointercancel", lost)
  }

  function pressOn(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip, enter?: ElementId) {
    const id = element.id
    if (id === null) return
    const frame = frameOf(event.currentTarget, element)
    if (frame === null || (grip === "move" && inText(event.target, frame))) return
    event.preventDefault()
    pressedFrame.current = frame
    frame.focus()
    const ids = grip === "move" ? movingWith(id) : [id]
    if (ids.length === 1) choose(alone(size, id))
    const starts = startsOf(ids)
    if (!starts.has(id)) return
    const from = { x: event.clientX, y: event.clientY }
    const keepRatio = element.kind === "picture"
    const rotation = element.box?.rotation ?? 0
    const drag: Drag = {
      by: "pointer",
      ids: ids.filter((each) => starts.has(each)),
      grip,
      pointer: event.pointerId,
      from,
      starts,
      moved: false,
      keepRatio,
      rotation,
    }
    follow(enter === undefined ? drag : { ...drag, enter }, frame.ownerDocument)
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
    const starts = startsOf([id])
    if (!starts.has(id)) return
    const from = { x: event.clientX, y: event.clientY }
    const keepRatio = element.kind === "picture"
    const rotation = element.box?.rotation ?? 0
    follow(
      {
        by: "pointer",
        ids: [id],
        grip: "move",
        pointer: event.pointerId,
        from,
        starts,
        moved: false,
        keepRatio,
        rotation,
      },
      frame.ownerDocument,
    )
  }

  function chooseOn(event: PointerEvent<HTMLElement>, element: CanvasElement, deep: boolean) {
    if (element.id === null) return
    event.preventDefault()
    const next = deep ? deepToggled(size, latest.current, element.id) : toggled(size, latest.current, element.id)
    choose(next)
    focusSelection(event.currentTarget, next)
  }

  function press(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) {
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
      chooseOn(event, element, mod)
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
    if (element.editable && !inText(event.target, event.currentTarget)) {
      const frame = frameOf(event.currentTarget, element)
      if (frame !== null && enterText(frame)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }

  function key(event: KeyboardEvent<HTMLElement>, element: CanvasElement) {
    const id = element.id
    if (id === null || event.nativeEvent.isComposing) return
    if (picking?.ownsKey !== undefined && !picking.ownsKey(event)) return
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
        if (parent !== null) {
          choose(parent)
          focusSelection(frame, parent)
        } else frame.closest<HTMLElement>(slidePaint)?.focus()
      }
      return
    }
    if (!onFrame) return
    const now = held.current
    if (gesture === "select-parent") {
      if (now !== null) return
      const parent = parentSelection(size, latest.current)
      if (parent !== null) {
        event.preventDefault()
        choose(parent)
        focusSelection(frame, parent)
      }
      return
    }
    if (gesture === "select-next") {
      if (now !== null) return
      const next = siblingSelection(size, latest.current, event.shiftKey ? -1 : 1)
      if (next !== null) {
        event.preventDefault()
        choose(next)
        focusSelection(frame, next)
      }
      return
    }
    if (gesture === "auto-layout") {
      if (now !== null || grouping?.onFrame === undefined) return
      event.preventDefault()
      grouping.onFrame(latest.current.ids)
      return
    }
    if (gesture === "group" || gesture === "ungroup") {
      if (now !== null) return
      const ids = latest.current.ids
      if (gesture === "group" && ids.length >= 2 && grouping?.onGroup !== undefined) {
        event.preventDefault()
        grouping.onGroup(ids)
      }
      if (gesture === "ungroup" && element.kind === "group" && grouping?.onUngroup !== undefined) {
        event.preventDefault()
        grouping.onUngroup(id)
      }
      return
    }
    if (gesture === "edit-text") {
      if (now !== null) return
      const children = childrenSelection(size, latest.current)
      if (children !== null) {
        event.preventDefault()
        choose(children)
        focusSelection(frame, children)
        return
      }
      if (enterText(frame)) event.preventDefault()
      return
    }
    if (gesture === "front" || gesture === "forward" || gesture === "backward" || gesture === "back") {
      if (onOrder === undefined || now !== null) return
      event.preventDefault()
      onOrder(id, gesture)
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
    onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
      const now = held.current
      if (now?.by === "keys" && isArrow(event.key)) {
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
    message,
    say: setMessage,
    select,
    press,
    doubleClick,
    key,
    slide,
  }
}
