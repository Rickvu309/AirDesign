import type { Box, ElementId, StackMove } from "@airdesign/document"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import {
  boxOf,
  draggedBoxes,
  isArrow,
  nudgedBoxes,
  resizedByKey,
  sameBox,
  travelled,
  type Drag,
  type Grip,
  type Held,
  type Moved,
} from "./box-gesture.js"
import { gestureFor } from "./gestures.js"
import { typeHeld } from "./held-keys.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import {
  alone,
  focused,
  kept,
  leadOf,
  noSelection,
  picked,
  sameSelection,
  toggled,
  unitOf,
  type Selection,
} from "./selection.js"
import type { BoxGrip, PaintStore } from "./store.js"

export type Grouping = {
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
}

export type Picking = {
  readonly selection?: Selection
  readonly onSelection?: (selection: Selection) => void
}

export type Moves = {
  readonly selection: Selection
  readonly message: string
  readonly say: (message: string) => void
  readonly select: (id: ElementId) => void
  readonly press: (event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) => void
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
  }

  function place(boxes: ReadonlyMap<ElementId, Box>) {
    for (const [id, box] of boxes) grips.current.get(id)?.place(box)
  }

  function letGo(changed: readonly ElementId[]) {
    held.current = null
    for (const [id, grip] of grips.current) {
      if (changed.includes(id)) grip.keep()
      else grip.release()
    }
    grips.current = new Map()
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
    function move(event: globalThis.PointerEvent) {
      const now = held.current
      if (now?.by !== "pointer" || event.pointerId !== now.pointer) return
      const at = { x: event.clientX, y: event.clientY }
      if (!now.moved && !travelled(now.from, at)) return
      held.current = { ...now, moved: true }
      place(draggedBoxes(now, at, width, size))
    }
    function stop() {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", end)
      document.removeEventListener("pointercancel", lost)
      cancelling.current = null
    }
    function cancel() {
      stop()
      letGo([])
    }
    function end(event: globalThis.PointerEvent) {
      if (event.pointerId !== pressed.pointer) return
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

  function chooseOn(event: PointerEvent<HTMLElement>, element: CanvasElement) {
    if (element.id === null) return
    event.preventDefault()
    const next = toggled(size, latest.current, element.id)
    choose(next)
    const lead = elementOf(leadOf(next))
    const frame = lead === undefined ? null : frameOf(event.currentTarget, lead)
    if (frame !== null) frame.focus()
    else event.currentTarget.closest<HTMLElement>(slidePaint)?.focus()
  }

  function press(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) {
    const id = element.id
    if (id === null || event.button !== 0 || held.current !== null) return
    if (grip === "move" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      chooseOn(event, element)
      return
    }
    const unit = grip === "move" ? elementOf(unitOf(size, latest.current, id)) : undefined
    if (unit?.id === undefined || unit.id === null || unit.id === id) {
      pressOn(event, element, grip)
      return
    }
    const next = leadOf(picked(size, latest.current, id))
    const own = frameOf(event.currentTarget, element)
    if (next === unit.id) pressOn(event, unit, "move")
    else if (own !== null && inText(event.target, own)) choose(alone(size, id))
    else pressOn(event, unit, "move", next ?? undefined)
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
      else if (onFrame) frame.closest<HTMLElement>(slidePaint)?.focus()
      else frame.focus()
      return
    }
    if (!onFrame) return
    const now = held.current
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
    const label = starts.size > 1 ? `${String(starts.size)} elements` : (frame.getAttribute("aria-label") ?? "")
    keyed.current = { verb: "Moved", label }
    place(next)
  }

  const slide = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || event.button !== 0) return
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

  return { selection, message, say: setMessage, select, press, key, slide }
}
