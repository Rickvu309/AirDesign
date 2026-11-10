import type { ElementId } from "./brand.js"
import { useElement } from "./element-view.js"
import type { PaintStore } from "./store.js"

export function Passage(props: { readonly store: PaintStore; readonly id: ElementId }) {
  const record = useElement(props.store, props.id)
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => {
        props.store.beginComposition(props.id)
      }}
      onCompositionEnd={(event) => {
        props.store.endComposition(props.id, event.data)
      }}
    >
      {record === null ? "" : record.text}
    </div>
  )
}
