import { useRef } from "react"
import type { ElementId } from "./brand.js"
import { useElement } from "./element-view.js"
import type { PaintStore } from "./store.js"

export function Passage(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly onEdit?: (value: string) => void
}) {
  const record = useElement(props.store, props.id)
  const composing = useRef(false)
  const reported = useRef(record === null ? "" : record.text)
  if (!composing.current) reported.current = record === null ? "" : record.text
  function report(value: string) {
    if (value === reported.current) return
    reported.current = value
    props.onEdit?.(value)
  }
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => {
        composing.current = true
        props.store.beginComposition(props.id)
      }}
      onCompositionEnd={(event) => {
        const value = event.currentTarget.textContent ?? ""
        props.store.endComposition(props.id, event.data)
        report(value)
        composing.current = false
      }}
      onInput={(event) => {
        const native = event.nativeEvent
        if (composing.current || (native instanceof InputEvent && native.isComposing)) return
        report(event.currentTarget.textContent ?? "")
      }}
    >
      {record === null ? "" : record.text}
    </div>
  )
}
