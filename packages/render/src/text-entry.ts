import type { Point } from "./box-gesture.js"
import { typeHeld } from "./held-keys.js"
import type { CanvasElement } from "./record.js"

const editableText = '[contenteditable="true"]'
const slidePaint = "[data-slide-paint]"

export function editingText(target: EventTarget, frame: HTMLElement): boolean {
  const text = target instanceof Element ? target.closest(editableText) : null
  if (text === null || !frame.contains(text)) return false
  const typing = text.ownerDocument.activeElement?.closest(editableText)
  return typing !== null && typing !== undefined && frame.closest(slidePaint)?.contains(typing) === true
}

type PointerAt = {
  readonly target: EventTarget
  readonly clientX: number
  readonly clientY: number
  preventDefault(): void
  stopPropagation(): void
}

function restingText(target: EventTarget, frame: HTMLElement): boolean {
  const text = target instanceof Element ? target.closest(editableText) : null
  return text !== null && frame.contains(text) && !editingText(target, frame)
}

export function pressOutOfText(event: PointerAt, frame: HTMLElement | null): void {
  if (frame === null || !restingText(event.target, frame)) return
  event.preventDefault()
  frame.focus()
}

function caretAt(text: HTMLElement, at: Point | undefined): Range {
  const document = text.ownerDocument
  const position = at === undefined ? null : (document.caretPositionFromPoint?.(at.x, at.y) ?? null)
  const range = document.createRange()
  if (position !== null && text.contains(position.offsetNode)) {
    range.setStart(position.offsetNode, position.offset)
    return range
  }
  range.selectNodeContents(text)
  range.collapse(false)
  return range
}

function textUnder(frame: HTMLElement, at: Point | undefined): HTMLElement | null {
  const found = at === undefined ? null : frame.ownerDocument.elementFromPoint?.(at.x, at.y)
  const under = found instanceof HTMLElement && frame.contains(found) ? found : null
  const named = under?.closest<HTMLElement>(editableText) ?? under?.querySelector<HTMLElement>(editableText) ?? null
  return named !== null && frame.contains(named) ? named : frame.querySelector<HTMLElement>(editableText)
}

export function enterText(frame: HTMLElement, at?: Point): boolean {
  const text = textUnder(frame, at)
  if (text === null) return false
  text.focus()
  const caret = text.ownerDocument.getSelection()
  caret?.removeAllRanges()
  caret?.addRange(caretAt(text, at))
  return true
}

export function enterTextAt(event: PointerAt, frame: HTMLElement): void {
  if (editingText(event.target, frame)) return
  if (enterText(frame, { x: event.clientX, y: event.clientY })) {
    event.preventDefault()
    event.stopPropagation()
  }
}

export function enterElement(slide: HTMLElement, element: CanvasElement, typed: string, selects = false): void {
  const frame = slide.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`)
  if (frame === null) return
  if (!selects && enterText(frame)) typeHeld(slide.ownerDocument, typed)
  else frame.focus()
}
