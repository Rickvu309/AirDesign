import type { Box, ElementId } from "@airdesign/document"
import { useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react"
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
  type Selection,
  type SlideSize,
} from "./box-gesture.js"
import { typeHeld } from "./held-keys.js"
import type { CanvasElement } from "./record.js"
import type { PaintStore } from "./store.js"

export type Moves = {
  readonly selected: Selection
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

export function canMove(element: CanvasElement): boolean {
  return element.id !== null && element.movable === true && element.box !== null
}

export function canResize(element: CanvasElement): boolean {
  return canMove(element) && element.box?.rotation === 0 && element.table === undefined
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
  size: SlideSize,
  width: number,
  onBox: ((id: ElementId, box: Box) => void) | undefined,
  onRemove?: (id: ElementId) => void,
): Moves {
  const [selected, setSelected] = useState<Selection>(null)
  const [message, setMessage] = useState("")
  const keyed = useRef({ verb: "", label: "" })
  const gesture = useRef<Gesture | null>(null)
  const cancelling = useRef<(() => void) | null>(null)

  function startOf(element: CanvasElement): Box | null {
    if (element.id === null) return null
    return store.getBox(element.id) ?? (element.box === null ? null : boxOf(element.box))
  }

  function finish(done: Gesture) {
    gesture.current = null
    const box = store.getBox(done.id)
    if (box !== null && !sameBox(box, done.start)) onBox?.(done.id, box)
  }

  function follow(pressed: Drag, document: Document) {
    const before = store.getBox(pressed.id)
    function move(event: globalThis.PointerEvent) {
      const now = gesture.current
      if (now?.by !== "pointer" || event.pointerId !== now.pointer) return
      const at = { x: event.clientX, y: event.clientY }
      if (!now.moved && !travelled(now.from, at)) return
      gesture.current = { ...now, moved: true }
      store.placeBox(now.id, draggedBox(now, at, width, size))
    }
    function stop() {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", end)
      document.removeEventListener("pointercancel", lost)
      cancelling.current = null
    }
    function cancel() {
      stop()
      gesture.current = null
      store.placeBox(pressed.id, before)
    }
    function end(event: globalThis.PointerEvent) {
      if (event.pointerId !== pressed.pointer) return
      stop()
      const now = gesture.current
      if (now !== null) finish(now)
    }
    function lost(event: globalThis.PointerEvent) {
      if (event.pointerId === pressed.pointer) cancel()
    }
    gesture.current = pressed
    cancelling.current = cancel
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", end)
    document.addEventListener("pointercancel", lost)
  }

  function press(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) {
    const id = element.id
    if (id === null || event.button !== 0 || gesture.current !== null) return
    const frame = frameOf(event.currentTarget, element)
    if (frame === null || (grip === "move" && inText(event.target, frame))) return
    event.preventDefault()
    frame.focus()
    setSelected(id)
    const start = startOf(element)
    if (start === null || !(grip === "move" ? canMove(element) : canResize(element))) return
    const from = { x: event.clientX, y: event.clientY }
    const keepRatio = element.kind === "picture"
    follow(
      { by: "pointer", id, grip, pointer: event.pointerId, from, start, moved: false, keepRatio },
      frame.ownerDocument,
    )
  }

  function key(event: KeyboardEvent<HTMLElement>, element: CanvasElement) {
    const id = element.id
    if (id === null || event.nativeEvent.isComposing) return
    const frame = event.currentTarget
    const onFrame = event.target === frame
    if (event.key === "Escape") {
      event.preventDefault()
      const cancel = cancelling.current
      if (cancel !== null) cancel()
      else if (onFrame) frame.closest<HTMLElement>(slidePaint)?.focus()
      else frame.focus()
      return
    }
    if (!onFrame) return
    if (event.key === "Enter") {
      if (enterText(frame)) event.preventDefault()
      return
    }
    const now = gesture.current
    const start = startOf(element)
    const chord = event.altKey || event.ctrlKey || event.metaKey
    if ((event.key === "Delete" || event.key === "Backspace") && !chord && now === null && canMove(element)) {
      if (onRemove === undefined) return
      event.preventDefault()
      onRemove(id)
      return
    }
    const resizing = event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
    if (resizing && start !== null && canResize(element) && now?.by !== "pointer") {
      const grown = resizedByKey(start, event.key)
      if (grown === null) return
      event.preventDefault()
      if (now === null) gesture.current = { by: "keys", id, start }
      keyed.current = { verb: "Resized", label: frame.getAttribute("aria-label") ?? "" }
      store.placeBox(id, grown)
      return
    }
    if (start === null || chord || !canMove(element) || now?.by === "pointer") return
    const next = nudgedBox(start, event.key, event.shiftKey, size)
    if (next === null) return
    event.preventDefault()
    if (now === null) gesture.current = { by: "keys", id, start }
    keyed.current = { verb: "Moved", label: frame.getAttribute("aria-label") ?? "" }
    store.placeBox(id, next)
  }

  const slide = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || event.button !== 0) return
      event.preventDefault()
      event.currentTarget.focus()
    },
    onFocus(event: FocusEvent<HTMLDivElement>) {
      if (event.target === event.currentTarget) setSelected(null)
    },
    onBlur(event: FocusEvent<HTMLDivElement>) {
      const now = gesture.current
      if (now?.by === "keys") finish(now)
      const next = event.relatedTarget
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) setSelected(null)
    },
    onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
      const now = gesture.current
      if (now?.by === "keys" && isArrow(event.key)) {
        finish(now)
        setMessage(`${keyed.current.verb} ${keyed.current.label}`)
      }
    },
  }

  return { selected, message, say: setMessage, select: setSelected, press, key, slide }
}
