import { useLayoutEffect, useRef } from "react"
import type { ElementId } from "./brand.js"
import { useElement } from "./element-view.js"
import type { PaintStore } from "./store.js"

function caretOffsets(box: HTMLElement): readonly [number, number] | null {
  const selection = box.ownerDocument.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const caret = selection.getRangeAt(0)
  if (!box.contains(caret.startContainer) || !box.contains(caret.endContainer)) return null
  const before = box.ownerDocument.createRange()
  before.selectNodeContents(box)
  before.setEnd(caret.startContainer, caret.startOffset)
  const start = before.toString().length
  before.setEnd(caret.endContainer, caret.endOffset)
  return [start, before.toString().length]
}

function showText(box: HTMLElement, text: string): void {
  const caret = caretOffsets(box)
  box.textContent = text
  if (caret === null) return
  const selection = box.ownerDocument.getSelection()
  if (selection === null) return
  const node = box.firstChild ?? box
  const kept = box.ownerDocument.createRange()
  kept.setStart(node, Math.min(caret[0], text.length))
  kept.setEnd(node, Math.min(caret[1], text.length))
  selection.removeAllRanges()
  selection.addRange(kept)
}

function pastedLine(data: DataTransfer): string {
  const plain = data.getData("text/plain")
  const text =
    plain !== ""
      ? plain
      : (new DOMParser().parseFromString(data.getData("text/html"), "text/html").body.textContent ?? "")
  return text.replace(/\s*[\r\n]+\s*/g, " ")
}

export function Passage(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly onEdit?: (value: string) => void
}) {
  const record = useElement(props.store, props.id)
  const text = record === null ? "" : record.text
  const box = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const reported = useRef(text)
  const pending = useRef<string[]>([])
  useLayoutEffect(() => {
    const shown = box.current
    if (shown === null || composing.current) return
    const echoed = pending.current.indexOf(text)
    if (echoed >= 0) {
      pending.current.splice(0, echoed + 1)
      return
    }
    pending.current.length = 0
    reported.current = text
    if (shown.textContent !== text) showText(shown, text)
  }, [record, text])
  function report(value: string) {
    if (value === reported.current) return
    reported.current = value
    if (props.onEdit === undefined) return
    pending.current.push(value)
    props.onEdit(value)
  }
  return (
    <div
      ref={box}
      contentEditable={props.onEdit !== undefined}
      style={{ whiteSpace: "pre-wrap" }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !composing.current && !event.nativeEvent.isComposing) event.preventDefault()
      }}
      onPaste={(event) => {
        event.preventDefault()
        event.currentTarget.ownerDocument.execCommand("insertText", false, pastedLine(event.clipboardData))
      }}
      onDrop={(event) => {
        event.preventDefault()
      }}
      onCompositionStart={() => {
        composing.current = true
        props.store.beginComposition(props.id)
      }}
      onCompositionEnd={(event) => {
        const value = event.currentTarget.textContent ?? ""
        pending.current.push(event.data)
        props.store.endComposition(props.id, event.data)
        report(value)
        composing.current = false
      }}
      onInput={(event) => {
        const native = event.nativeEvent
        if (composing.current || (native instanceof InputEvent && native.isComposing)) return
        report(event.currentTarget.textContent ?? "")
      }}
    />
  )
}
