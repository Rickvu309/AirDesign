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
  draggedBox,
  isArrow,
  nudgedBox,
  resizedByKey,
  sameBox,
  travelled,
  type Drag,
  type Gesture,
  type Grip,
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
  onBox: ((id: ElementId, box: Box) => void) | undefined,
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
  const held = useRef<Gesture | null>(null)
  const grip = useRef<BoxGrip | null>(null)
  const cancelling = useRef<(() => void) | null>(null)
  const pressedFrame = useRef<HTMLElement | null>(null)
  useEffect(() => () => letGo(false), [])

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

  function hold(next: Gesture) {
    held.current = next
    grip.current = store.gripBox(next.id)
  }

  function letGo(changed: boolean) {
    held.current = null
    if (changed) grip.current?.keep()
    else grip.current?.release()
    grip.current = null
  }

  function finish(done: Gesture) {
    const box = store.getBox(done.id)
    const changed = box !== null && !sameBox(box, done.start)
    letGo(changed)
    if (changed) onBox?.(done.id, box)
  }

  function follow(pressed: Drag, document: Document) {
    function move(event: globalThis.PointerEvent) {
      const now = held.current
      if (now?.by !== "pointer" || event.pointerId !== now.pointer) return
      const at = { x: event.clientX, y: event.clientY }
      if (!now.moved && !travelled(now.from, at)) return
      held.current = { ...now, moved: true }
      grip.current?.place(draggedBox(now, at, width, size))
    }
    function stop() {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", end)
      document.removeEventListener("pointercancel", lost)
      cancelling.current = null
    }
    function cancel() {
      stop()
      letGo(false)
    }
    function end(event: globalThis.PointerEvent) {
      if (event.pointerId !== pressed.pointer) return
      stop()
      const now = held.current
      if (now !== null) finish(now)
      if (now?.by === "pointer" && !now.moved && now.enter !== undefined) entered(now)
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
    choose(alone(size, id))
    const start = startOf(element)
    if (start === null || !canDrag(element)) return
    const from = { x: event.clientX, y: event.clientY }
    const keepRatio = element.kind === "picture"
    const rotation = element.box?.rotation ?? 0
    const drag: Drag = {
      by: "pointer",
      id,
      grip,
      pointer: event.pointerId,
      from,
      start,
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
    const start = startOf(element)
    if (start === null || !canDrag(element) || now?.by === "pointer") return
    if (gesture === "resize-keys") {
      const grown = resizedByKey(start, event.key, element.box?.rotation ?? 0)
      if (grown === null) return
      event.preventDefault()
      if (now === null) hold({ by: "keys", id, start })
      keyed.current = { verb: "Resized", label: frame.getAttribute("aria-label") ?? "" }
      grip.current?.place(grown)
      return
    }
    if (gesture !== "nudge" && gesture !== "nudge-far") return
    const next = nudgedBox(start, event.key, gesture === "nudge-far", size)
    if (next === null) return
    event.preventDefault()
    if (now === null) hold({ by: "keys", id, start })
    keyed.current = { verb: "Moved", label: frame.getAttribute("aria-label") ?? "" }
    grip.current?.place(next)
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
