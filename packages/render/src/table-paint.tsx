import type { ElementId } from "@airdesign/document"
import { paintedAt } from "./box-gesture.js"
import { useBox } from "./element-view.js"
import type { CanvasTable } from "./record.js"
import type { Moves } from "./slide-moves.js"
import { elementFrame, type ElementPaintProps } from "./element-host.js"
import { TableArt } from "./table-art.js"

function TableObject(
  props: ElementPaintProps & { readonly id: ElementId; readonly moves: Moves; readonly table: CanvasTable },
) {
  const { element, id, moves, scaled, table } = props
  const box = paintedAt(element.box, useBox(props.store, id))
  return (
    <TableArt
      box={box}
      elementKey={element.key}
      scaled={scaled}
      table={table}
      frame={{
        "aria-label": "Table",
        tabIndex: 0,
        onPointerDown: (event) => moves.press(event, element, "move"),
        onDoubleClick: (event) => moves.doubleClick(event, element),
        onKeyDown: (event) => moves.key(event, element),
        onFocus: () => moves.select(id),
      }}
      style={{
        ...(box === null
          ? {}
          : { position: "absolute", left: scaled(box.x), top: scaled(box.y), width: scaled(box.width) }),
        pointerEvents: "auto",
        cursor: "move",
        touchAction: "none",
      }}
    />
  )
}

export function TablePaint(props: ElementPaintProps) {
  const { element, moves, scaled } = props
  if (element.table === undefined) return null
  if (element.id !== null && moves !== null)
    return <TableObject {...props} id={element.id} moves={moves} table={element.table} />
  return (
    <TableArt
      box={element.box}
      elementKey={element.key}
      scaled={scaled}
      style={elementFrame(element, scaled, false, false)}
      table={element.table}
    />
  )
}
