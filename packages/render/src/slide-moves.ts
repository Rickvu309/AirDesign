import type { Box, ElementId, StackMove } from "@airdesign/document"
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react"
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
import { gestureFor } from "./gestures.js"
import { typeHeld } from "./held-keys.js"
import type { CanvasElement } from "./record.js"
import type { BoxGrip, PaintStore } from "./store.js"

export type Grouping = {
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
  readonly onChoose?: (ids: readonly ElementId[]) => void
}

export type Moves = {
  readonly selected: Selection
  readonly chosen: readonly ElementId[]
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
  size: SlideSize & { readonly elements?: readonly CanvasElement[] },
  width: number,
  onBox: ((id: ElementId, box: Box) => void) | undefined,
  onRemove?: (ids: readonly ElementId[]) => void,
  onOrder?: (id: ElementId, move: StackMove) => void,
  onSelect?: (id: Selection) => void,
  grouping?: Grouping,
): Moves {
  const [selected, setSelected] = useState<Selection>(null)
  const [chosen, setChosen] = useState<readonly ElementId[]>([])
  const onChoose = grouping?.onChoose
  useEffect(() => {
    onSelect?.(selected)
  }, [onSelect, selected])
  useEffect(() => {
    onChoose?.(chosen)
  }, [onChoose, chosen])
  const [message, setMessage] = useState("")
  const keyed = useRef({ verb: "", label: "" })
  const held = useRef<Gesture | null>(null)
  const grip = useRef<BoxGrip | null>(null)
  const cancelling = useRef<(() => void) | null>(null)
  const pressedFrame = useRef<HTMLElement | null>(null)
  useEffect(() => () => letGo(false), [])

  function elementOf(id: ElementId | undefined): CanvasElement | undefined {
    return id === undefined ? undefined : size.elements?.find((each) => each.id === id)
  }

  function only(id: Selection) {
    setSelected(id)
    setChosen(id === null ? [] : [id])
  }

  function entered(done: Drag) {
    const child = elementOf(done.enter)
    const frame = pressedFrame.current
    if (child?.id === undefined || child.id === null || frame === null) return
    only(child.id)
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
    only(id)
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

  function chooseOn(event: PointerEvent<HTMLElement>, unit: CanvasElement) {
    const frame = unit.id === null ? null : frameOf(event.currentTarget, unit)
    if (frame === null || unit.id === null) return
    event.preventDefault()
    const id = unit.id
    const next = chosen.includes(id) ? chosen.filter((each) => each !== id) : [...chosen, id]
    setChosen(next)
    setSelected(next.includes(id) ? id : (next.at(-1) ?? null))
    frame.focus()
  }

  function press(event: PointerEvent<HTMLElement>, element: CanvasElement, grip: Grip) {
    if (element.id === null || event.button !== 0 || held.current !== null) return
    const group = elementOf(element.group?.id)
    if (grip === "move" && event.shiftKey) {
      chooseOn(event, group ?? element)
      return
    }
    if (grip !== "move" || group === undefined || group.id === null) {
      pressOn(event, element, grip)
      return
    }
    const inside = selected === group.id || elementOf(selected ?? undefined)?.group?.id === group.id
    const own = frameOf(event.currentTarget, element)
    if (!inside) pressOn(event, group, "move")
    else if (selected !== group.id) pressOn(event, element, grip)
    else if (own !== null && inText(event.target, own)) only(element.id)
    else pressOn(event, group, "move", element.id)
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
      if (gesture === "group" && chosen.length >= 2 && grouping?.onGroup !== undefined) {
        event.preventDefault()
        grouping.onGroup(chosen)
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
      const removable = (chosen.includes(id) ? chosen : [id]).filter((each) => {
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
      if (event.target === event.currentTarget) only(null)
    },
    onBlur(event: FocusEvent<HTMLDivElement>) {
      const now = held.current
      if (now?.by === "keys") finish(now)
      const next = event.relatedTarget
      if (next instanceof Element && next.closest(keepsSelection) !== null) return
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) only(null)
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
    setSelected(id)
    setChosen((now) => (now.includes(id) ? now : [id]))
  }

  return { selected, chosen, message, say: setMessage, select, press, key, slide }
}
