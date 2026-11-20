import { useSyncExternalStore } from "react"
import type { ElementPaintProps } from "./element-host.js"
import { PaintedElement } from "./element-kind.js"
import type { CopyBoard } from "./layer-copies.js"

export function CopiedLayer(props: ElementPaintProps & { readonly board: CopyBoard }) {
  const { board, element } = props
  const id = element.id
  const read = () => id !== null && board.has(id)
  const shown = useSyncExternalStore(board.subscribe, read, read)
  if (!shown) return null
  return (
    <div aria-hidden="true" data-copied-layer={element.key} style={{ display: "contents" }}>
      <PaintedElement {...props} moves={null} quiet />
    </div>
  )
}
