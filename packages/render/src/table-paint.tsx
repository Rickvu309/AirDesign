import { cellText, readTableValue, type ElementId, type TableChange, type TableValue } from "@airdesign/document"
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { paintedAt } from "./box-gesture.js"
import { useBox, useElement } from "./element-view.js"
import { framedOutline, refusedInput } from "./passage.js"
import type { CanvasElement, CanvasTable, CanvasText } from "./record.js"
import { SheetText } from "./sheet-text.js"
import type { Moves } from "./moves.js"
import type { PaintStore } from "./store.js"
import { elementFrame, type ElementPaintProps } from "./element-host.js"
import { cellTextFrame, TableArt, type Cell } from "./table-art.js"
import { textLook, type Scaled } from "./text-look.js"
import { leadOf } from "./selection.js"
import {
  cellHandles,
  edgeBars,
  sizedTable,
  type TableHandles,
  type TablePick,
  type TableSizing,
  type TableWords,
} from "./table-handles.js"

const typingOutline = "inset 0 0 0 2px var(--ring)"

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

function storedCells(text: string | undefined, table: CanvasTable): TableValue | "moving" | null {
  const stored = text === undefined ? null : readTableValue(text)
  if (stored === null) return null
  const fits =
    stored.rows.length === table.rows.length && stored.rows.every((row) => row.cells.length === table.columns.length)
  return fits ? stored : "moving"
}

function CellText(props: {
  readonly cell: Cell
  readonly spot: Spot
  readonly scaled: Scaled
  readonly active: boolean
  readonly shown: string
  readonly steady: boolean
  readonly onFocus: () => void
  readonly onBlur: (holder: HTMLElement) => void
  readonly onText: (text: string) => void
  readonly onKey: (event: KeyboardEvent<HTMLDivElement>) => void
}) {
  const { active, cell, scaled, shown, spot, steady } = props
  const holder = useRef<HTMLDivElement>(null)
  const pending = useRef<string[]>([])
  const text = cell.text
  useLayoutEffect(() => {
    const box = holder.current
    if (!active || box === null) return
    pending.current.length = 0
    box.textContent = shown
    caretAtEnd(box)
  }, [active])
  useLayoutEffect(() => {
    const box = holder.current
    if (!active || !steady || box === null) return
    const echoed = pending.current.indexOf(shown)
    if (echoed >= 0) {
      pending.current.splice(0, echoed + 1)
      return
    }
    pending.current.length = 0
    if (readText(box) === shown) return
    box.textContent = shown
    caretAtEnd(box)
  }, [shown, steady])
  useLayoutEffect(() => {
    const box = holder.current
    if (box === null) return
    function refuse(event: InputEvent) {
      if (refusedInput(event)) event.preventDefault()
    }
    box.addEventListener("beforeinput", refuse)
    return () => box.removeEventListener("beforeinput", refuse)
  }, [])
  const look = text === null ? null : textLook(text, scaled)
  const first = text?.paragraphs[0]
  const style =
    look === null || first === undefined
      ? {}
      : { ...look.paragraph(first.from, true), ...look.run(first.from, first.runs[0]?.from ?? -1) }
  const frame = text === null ? { flex: 1, minWidth: 0 } : cellTextFrame(text, scaled)
  return (
    <div data-typing={active ? "" : undefined} style={active ? { ...frame, boxShadow: typingOutline } : frame}>
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
          if (event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing) return
          const typed = readText(event.currentTarget)
          pending.current.push(typed)
          props.onText(typed)
        }}
        onKeyDown={props.onKey}
      >
        {active ? null : shown === plainText(text) && look !== null && text !== null ? (
          <SheetText text={text} look={{ ...look, body: { ...look.body, minHeight: undefined } }} />
        ) : (
          <span style={style}>{shown}</span>
        )}
      </div>
    </div>
  )
}

function TableEdit(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly table: CanvasTable
  readonly scaled: Scaled
  readonly moves: Moves
  readonly onTable: (id: ElementId, change: TableChange) => void
  readonly words: TableWords | undefined
}) {
  const { element, id, moves, onTable, scaled, table, words } = props
  const [active, setActive] = useState<Spot | null>(null)
  const [picked, setPicked] = useState<TablePick | null>(null)
  const [sizing, setSizing] = useState<TableSizing | null>(null)
  const shown = sizedTable(table, sizing)
  const stored = storedCells(useElement(props.store, id)?.text, table)
  const pending = useRef<Spot | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const box = paintedAt(element.box, useBox(props.store, id))

  useEffect(() => {
    const wanted = pending.current
    if (wanted === null || wanted.row >= table.rows.length || wanted.column >= table.columns.length) return
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

  const selected = moves.selection.ids.length === 1 && leadOf(moves.selection) === id
  const fits = picked === null || picked.at < (picked.kind === "row" ? table.rows.length : table.columns.length)
  const handles: TableHandles | null =
    !selected || words === undefined
      ? null
      : {
          table: shown,
          box,
          scaled,
          words,
          picked: fits ? picked : null,
          onPick: setPicked,
          onSizing: setSizing,
          change,
          leave: () => frame.current?.querySelector<HTMLElement>("[data-canvas-table]")?.focus(),
        }

  const editor = (cell: Cell, at: number, column: number) => {
    const spot = { row: at, column }
    const here = spotKey(spot)
    const kept = stored === null || stored === "moving" ? undefined : stored.rows[at]?.cells[column]
    const text = (
      <CellText
        active={active !== null && spotKey(active) === here}
        cell={cell}
        onBlur={(holder) => {
          holder.textContent = ""
          setActive((now) => (now !== null && spotKey(now) === here ? null : now))
        }}
        onFocus={() => setActive(spot)}
        onKey={(event) => key(spot, event)}
        onText={(text) => change({ change: "cell", row: at, column, text })}
        scaled={scaled}
        shown={kept === undefined ? plainText(cell.text) : cellText(kept)}
        spot={spot}
        steady={stored !== "moving"}
      />
    )
    return (
      <>
        {text}
        {handles === null ? null : cellHandles(at, column, handles)}
      </>
    )
  }

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
          onDoubleClick: (event) => moves.doubleClick(event, element),
          onKeyDown: (event) => moves.key(event, element),
          onFocus: () => moves.select(id),
        }}
        scaled={scaled}
        style={{
          ...(box === null
            ? {}
            : { position: "absolute", left: scaled(box.x), top: scaled(box.y), width: scaled(box.width) }),
          pointerEvents: "auto",
          cursor: "move",
          touchAction: "none",
          ...framedOutline,
        }}
        table={shown}
      >
        {handles === null ? null : edgeBars(handles)}
      </TableArt>
    </div>
  )
}

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
        ...framedOutline,
      }}
    />
  )
}

export function TablePaint(props: ElementPaintProps) {
  const { element, moves, onTable, scaled, tableWords } = props
  if (element.table === undefined) return null
  if (element.id !== null && element.editable && moves !== null && onTable !== undefined)
    return (
      <TableEdit
        element={element}
        id={element.id}
        moves={moves}
        onTable={onTable}
        scaled={scaled}
        store={props.store}
        table={element.table}
        words={tableWords}
      />
    )
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
