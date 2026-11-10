import { useLayoutEffect, useRef } from "react"
import type { ElementId } from "./brand.js"
import { useElement } from "./element-view.js"
import type { PaintStore } from "./store.js"

export function Passage(props: { readonly store: PaintStore; readonly id: ElementId }) {
  const record = useElement(props.store, props.id)
  const text = record === null ? "" : record.text
  const editor = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  useLayoutEffect(() => {
    const node = editor.current
    if (node === null || composing.current) return
    const child = node.firstChild
    if (child instanceof Text && child === node.lastChild) {
      if (child.nodeValue !== text) child.nodeValue = text
      return
    }
    node.textContent = text
  }, [text])
  return (
    <div
      ref={editor}
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => {
        composing.current = true
        props.store.beginComposition(props.id)
      }}
      onCompositionEnd={(event) => {
        composing.current = false
        props.store.endComposition(props.id, event.data)
      }}
    />
  )
}
