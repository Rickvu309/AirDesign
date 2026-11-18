import { noSelection, type Selection } from "@airdesign/render"
import { useRef, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from "react"
import { flushSync } from "react-dom"
import { slideListCopy } from "@/copy/slide-list-copy"
import { cardPress, thumbElementAt } from "@/editor/grid-hit"
import { gridEditing, gridStep, type GridInteraction, type GridStep } from "@/editor/grid-interaction"
import { pickRange, pickToggle, toggledCurrent, type GridPick } from "@/editor/grid-selection"

const editableText = '[contenteditable="true"]'

function placeCaret(text: HTMLElement, x: number, y: number) {
  const document = text.ownerDocument
  const at = document.caretPositionFromPoint(x, y)
  const range = document.createRange()
  if (at !== null && text.contains(at.offsetNode)) range.setStart(at.offsetNode, at.offset)
  else {
    range.selectNodeContents(text)
    range.collapse(false)
  }
  const caret = document.getSelection()
  caret?.removeAllRanges()
  caret?.addRange(range)
}

function replay(frame: HTMLElement, event: PointerEvent<HTMLElement>) {
  frame.dispatchEvent(
    new window.PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      button: event.button,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    }),
  )
}

export function useGridEditing({
  world,
  state,
  dispatch,
  current,
  select,
  onSelect,
  announce,
}: {
  world: RefObject<HTMLDivElement | null>
  state: GridInteraction
  dispatch: (step: GridStep) => void
  current: number
  select: (selection: Selection) => void
  onSelect: (index: number) => void
  announce: (text: string) => void
}) {
  const replaying = useRef(false)
  const swallow = useRef(false)
  const editing = gridEditing(state)

  function step(next: GridStep) {
    if (!gridEditing(gridStep(state, next))) select(noSelection)
    dispatch(next)
  }

  function entry(index: number) {
    return world.current?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`) ?? null
  }

  function pick(index: number, shift: boolean, toggle: boolean, picked: GridPick) {
    if (!shift && !toggle) {
      step({ kind: "pick", pick: null })
      onSelect(index)
      return
    }
    const next = shift ? pickRange(picked, index, current) : pickToggle(picked, index, current)
    step({ kind: "pick", pick: next })
    if (next !== null) announce(slideListCopy.selected(next.slides.size))
    onSelect(toggledCurrent(next, index))
  }

  function open(index: number) {
    flushSync(() => {
      onSelect(index)
      step({ kind: "enter" })
    })
    world.current?.querySelector<HTMLElement>("[data-grid-edit] [data-slide-paint]")?.focus({ preventScroll: true })
    announce(slideListCopy.entered(index + 1))
  }

  function press(index: number, event: PointerEvent<HTMLDivElement>) {
    swallow.current = false
    const target = event.target
    if (replaying.current || event.button !== 0 || !(target instanceof Element)) return
    const live = target.closest("[data-grid-edit]") !== null
    const thumb = live ? null : thumbElementAt(event.currentTarget, event.clientX, event.clientY)
    const pressed = cardPress(event)
    if (pressed === null || pressed === "editor") return
    if (pressed === "slide") {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    swallow.current = true
    const key = thumb ?? target.closest<HTMLElement>("[data-canvas-element]")?.dataset.canvasElement
    flushSync(() => {
      if (index !== current) onSelect(index)
      step({ kind: "enter" })
    })
    const frame = event.currentTarget.querySelector<HTMLElement>(`[data-grid-edit] [data-canvas-element="${key}"]`)
    if (frame === null) return
    replaying.current = true
    try {
      replay(frame, event)
    } finally {
      replaying.current = false
    }
  }

  function click(index: number, picked: GridPick, event: MouseEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-grid-edit]") !== null &&
      cardPress(event) === "slide"
    ) {
      event.preventDefault()
      event.stopPropagation()
      flushSync(() => pick(index, event.shiftKey, event.metaKey || event.ctrlKey, picked))
      entry(index)?.focus({ preventScroll: true, focusVisible: false })
      return
    }
    const pressed = swallow.current
    swallow.current = false
    if (!pressed || event.detail === 0) return
    event.preventDefault()
    event.stopPropagation()
  }

  function double(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return
    const frame = event.target.closest("[data-grid-edit] [data-canvas-element]")
    const text = frame?.querySelector<HTMLElement>(editableText)
    if (text === null || text === undefined || text.contains(document.activeElement)) return
    text.focus({ preventScroll: true })
    placeCaret(text, event.clientX, event.clientY)
  }

  function key(event: KeyboardEvent<HTMLDivElement>, chrome = false) {
    if (event.key !== "Escape" || event.nativeEvent.isComposing || event.defaultPrevented) return
    if (!chrome && (!(event.target instanceof Element) || event.target.closest("[data-grid-viewport]") === null)) return
    if (state.kind === "none") {
      if (!chrome) return
      event.preventDefault()
      event.stopPropagation()
      world.current?.focus({ preventScroll: true, focusVisible: true })
      return
    }
    if (state.kind === "text" && !chrome) return
    event.preventDefault()
    event.stopPropagation()
    if (chrome || state.kind === "slides") {
      step({ kind: "escape" })
      world.current?.focus({ preventScroll: true, focusVisible: true })
      if (state.kind === "slides") announce(slideListCopy.nothingSelected)
      else if (state.kind === "elements") announce(slideListCopy.selected(1))
      return
    }
    flushSync(() => step({ kind: "escape" }))
    entry(current)?.focus({ preventScroll: true, focusVisible: true })
    announce(slideListCopy.selected(1))
  }

  function focus(event: FocusEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element) || event.target.closest("[data-grid-edit]") === null) return
    dispatch({ kind: event.target.closest(editableText) === null ? "enter" : "type" })
  }

  function activate() {
    if (!editing) flushSync(() => step({ kind: "enter" }))
  }

  function clear() {
    if (state.kind === "none") return
    step({ kind: "clear" })
    world.current?.focus({ preventScroll: true, focusVisible: false })
    announce(slideListCopy.nothingSelected)
  }

  return { editing, step, pick, open, press, click, double, key, focus, activate, clear }
}
