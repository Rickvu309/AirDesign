import type { ElementId, TableChange } from "@airdesign/document"
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { paintedAt } from "./box-gesture.js"
import { useBox } from "./element-view.js"
import type { CanvasElement, CanvasTable, CanvasText } from "./record.js"
import { SheetText } from "./sheet-text.js"
import type { Moves } from "./slide-moves.js"
import type { PaintStore } from "./store.js"
import { elementFrame, type ElementPaintProps } from "./element-host.js"
import { cellTextFrame, TableArt, type Cell } from "./table-art.js"
import { textLook, type Scaled } from "./text-look.js"

export type TableBar = (table: {
  readonly row: number
  readonly rows: number
  readonly change: (change: TableChange) => void
}) => ReactNode

type Spot = { readonly row: number; readonly column: number }

const spotKey = (spot: Spot) => `${spot.row}.${spot.column}`

function plainText(text: CanvasText | null): string {
  return (text?.paragraphs ?? []).map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function linesOf(node: Node): string {
  let text = ""
  for (const child of node.childNodes) {
    if (child.nodeType === child.TEXT_NODE) text += child.textContent ?? ""
    else if (child.nodeName === "BR") text += "\n"
    else if (child.nodeName !== "DIV" && child.nodeName !== "P") text += linesOf(child)
    else text += (text === "" || text.endsWith("\n") ? "" : "\n") + linesOf(child)
  }
  return text
}

function readText(holder: HTMLElement): string {
  return linesOf(holder).replace(/\r\n?/g, "\n").replace(/\n$/, "")
}

function caretAtEnd(holder: HTMLElement) {
  const range = holder.ownerDocument.createRange()
  range.selectNodeContents(holder)
  range.collapse(false)
  const caret = holder.ownerDocument.getSelection()
  caret?.removeAllRanges()
  caret?.addRange(range)
}

function nextSpot(table: CanvasTable, spot: Spot, back: boolean): Spot | null {
  const columns = table.columns.length
  const at = spot.row * columns + spot.column + (back ? -1 : 1)
  if (at < 0 || at >= table.rows.length * columns) return null
  return { row: Math.floor(at / columns), column: at % columns }
}

function CellText(props: {
  readonly cell: Cell
  readonly spot: Spot
  readonly scaled: Scaled
  readonly active: boolean
  readonly typed: string | undefined
  readonly onFocus: () => void
  readonly onBlur: (holder: HTMLElement) => void
  readonly onText: (text: string) => void
  readonly onKey: (event: KeyboardEvent<HTMLDivElement>) => void
}) {
  const { active, cell, scaled, spot, typed } = props
  const holder = useRef<HTMLDivElement>(null)
  const text = cell.text
  const shown = typed ?? plainText(text)
  useLayoutEffect(() => {
    const box = holder.current
    if (!active || box === null) return
    box.textContent = shown
    caretAtEnd(box)
  }, [active])
  const look = text === null ? null : textLook(text, scaled)
  const first = text?.paragraphs[0]
  const style =
    look === null || first === undefined
      ? {}
      : { ...look.paragraph(first.from, true), ...look.run(first.from, first.runs[0]?.from ?? -1) }
  const frame = text === null ? { flex: 1, minWidth: 0 } : cellTextFrame(text, scaled)
  return (
    <div style={frame}>
      <div
        ref={holder}
        contentEditable
        suppressContentEditableWarning
        tabIndex={-1}
        role="textbox"
        aria-multiline
        aria-label={`Row ${spot.row + 1}, column ${spot.column + 1}`}
        data-table-text={spotKey(spot)}
        style={{ flex: 1, outline: "none", minHeight: "1lh", whiteSpace: "pre-wrap", ...(active ? style : {}) }}
        onFocus={props.onFocus}
        onBlur={(event) => props.onBlur(event.currentTarget)}
        onInput={(event) => {
          if (!(event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing))
            props.onText(readText(event.currentTarget))
        }}
        onKeyDown={props.onKey}
      >
        {active ? null : typed === undefined && look !== null && text !== null ? (
          <SheetText text={text} look={{ ...look, body: { ...look.body, minHeight: undefined } }} />
        ) : (
          <span style={style}>{shown}</span>
        )}
      </div>
    </div>
  )
}

export function TableEdit(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly table: CanvasTable
  readonly scaled: Scaled
  readonly moves: Moves
  readonly onTable: (id: ElementId, change: TableChange) => void
  readonly bar?: TableBar | undefined
}) {
  const { element, id, moves, onTable, scaled, table } = props
  const [active, setActive] = useState<Spot | null>(null)
  const [row, setRow] = useState<number | null>(null)
  const [within, setWithin] = useState(false)
  const [typed, setTyped] = useState<ReadonlyMap<string, string>>(new Map())
  const pending = useRef<Spot | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const moved = paintedAt(element.box, useBox(props.store, id))
  const box =
    moved === null || element.box === null
      ? element.box
      : { ...moved, width: element.box.width, height: element.box.height }

  useEffect(() => {
    setTyped(new Map())
    const wanted = pending.current
    if (wanted === null || wanted.row >= table.rows.length) return
    pending.current = null
    frame.current?.querySelector<HTMLElement>(`[data-table-text="${spotKey(wanted)}"]`)?.focus()
  }, [table])

  function change(next: TableChange) {
    onTable(id, next)
  }

  function focusSpot(spot: Spot) {
    frame.current?.querySelector<HTMLElement>(`[data-table-text="${spotKey(spot)}"]`)?.focus()
  }

  function key(spot: Spot, event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || event.nativeEvent.isComposing) return
    event.preventDefault()
    const next = nextSpot(table, spot, event.shiftKey)
    if (next !== null) {
      focusSpot(next)
      return
    }
    if (event.shiftKey) return
    pending.current = { row: table.rows.length, column: 0 }
    change({ change: "row", row: spot.row, place: "below" })
  }

  const editor = (cell: Cell, at: number, column: number) => {
    const spot = { row: at, column }
    const here = spotKey(spot)
    return (
      <CellText
        active={active !== null && spotKey(active) === here}
        cell={cell}
        onBlur={(holder) => {
          holder.textContent = ""
          setActive((now) => (now !== null && spotKey(now) === here ? null : now))
        }}
        onFocus={() => {
          setActive(spot)
          setRow(at)
        }}
        onKey={(event) => key(spot, event)}
        onText={(text) => {
          setTyped((now) => new Map(now).set(here, text))
          change({ change: "cell", row: at, column, text })
        }}
        scaled={scaled}
        spot={spot}
        typed={typed.get(here)}
      />
    )
  }

  const shown = within && row !== null && row < table.rows.length ? row : null
  return (
    <div ref={frame} style={{ display: "contents" }}>
      <TableArt
        box={box}
        edit={editor}
        elementKey={element.key}
        frame={{
          "aria-label": "Table",
          tabIndex: 0,
          onPointerDown: (event) => moves.press(event, element, "move"),
          onKeyDown: (event) => moves.key(event, element),
          onFocus: () => {
            setWithin(true)
            moves.select(id)
          },
          onBlur: (event) => {
            const next = event.relatedTarget
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) setWithin(false)
          },
        }}
        scaled={scaled}
        style={{
          ...(box === null
            ? {}
            : { position: "absolute", left: scaled(box.x), top: scaled(box.y), width: scaled(box.width) }),
          pointerEvents: "auto",
          cursor: "move",
          touchAction: "none",
        }}
        table={table}
      >
        {props.bar === undefined || shown === null ? null : (
          <div
            data-table-bar
            style={{ position: "absolute", left: 0, bottom: "100%", paddingBottom: "var(--space-8)", cursor: "auto" }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {props.bar({ row: shown, rows: table.rows.length, change })}
          </div>
        )}
      </TableArt>
    </div>
  )
}

export function TablePaint(props: ElementPaintProps) {
  const { element, moves, onTable, scaled } = props
  if (element.table === undefined) return null
  if (element.id !== null && element.editable && moves !== null && onTable !== undefined)
    return (
      <TableEdit
        bar={props.tableBar}
        element={element}
        id={element.id}
        moves={moves}
        onTable={onTable}
        scaled={scaled}
        store={props.store}
        table={element.table}
      />
    )
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
