import {
  cellText,
  readTableValue,
  tabbedHtml,
  writeTabbed,
  type CellRange,
  type CellTexts,
  type ElementId,
  type TableChange,
  type TableValue,
} from "@airdesign/document"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
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
import { gestureFor } from "./gestures.js"
import { manyCells, readPastedCells } from "./pasted-cells.js"
import {
  cellHandles,
  edgeBars,
  pickSpan,
  sizedTable,
  type TableHandles,
  type TablePick,
  type TableSizing,
  type TableWords,
} from "./table-handles.js"

const typingOutline = "inset 0 0 0 2px var(--ring)"
const clickSlop = 3

type Spot = { readonly row: number; readonly column: number }

type CellPick = { readonly anchor: Spot; readonly to: Spot }

type Press = { readonly spot: Spot; readonly x: number; readonly y: number }

const spotKey = (spot: Spot) => `${spot.row}.${spot.column}`

const sameSpot = (left: Spot | null, right: Spot) => left !== null && spotKey(left) === spotKey(right)

function spotAt(target: EventTarget | null): Spot | null {
  const cell = target instanceof Element ? target.closest<HTMLElement>("[data-table-cell]") : null
  const [row, column] = (cell?.dataset.tableCell ?? "").split(".").map(Number)
  return row === undefined || column === undefined || Number.isNaN(row) || Number.isNaN(column) ? null : { row, column }
}

function cellRange(pick: CellPick): CellRange {
  const { anchor, to } = pick
  return {
    rows: [Math.min(anchor.row, to.row), Math.max(anchor.row, to.row)],
    columns: [Math.min(anchor.column, to.column), Math.max(anchor.column, to.column)],
  }
}

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
  readonly onCells: (cells: CellTexts) => void
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
        onPaste={(event) => {
          const cells = readPastedCells(event.clipboardData)
          if (!manyCells(cells)) return
          event.preventDefault()
          props.onCells(cells)
        }}
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
  readonly onCells: ((id: ElementId, cells: CellRange | null) => void) | undefined
}) {
  const { element, id, moves, onTable, onCells, scaled, table, words } = props
  const [active, setActive] = useState<Spot | null>(null)
  const [picked, setPicked] = useState<TablePick | null>(null)
  const [cells, setCells] = useState<CellPick | null>(null)
  const [sizing, setSizing] = useState<TableSizing | null>(null)
  const shown = sizedTable(table, sizing)
  const lastRow = table.rows.length - 1
  const lastColumn = table.columns.length - 1
  const stored = storedCells(useElement(props.store, id)?.text, table)
  const pending = useRef<Spot | null>(null)
  const press = useRef<Press | null>(null)
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

  function focusTable() {
    frame.current?.querySelector<HTMLElement>("[data-canvas-table]")?.focus()
  }

  function key(spot: Spot, event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return
    if (gestureFor(event, "text") === "deselect") {
      setCells(null)
      return
    }
    if (event.key !== "Tab") return
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
  const wasSelected = useRef(selected)
  useEffect(() => {
    const left = wasSelected.current && !selected
    wasSelected.current = selected
    if (!left) return
    setCells(null)
    setPicked(null)
  }, [selected])

  const fits = (pick: TablePick | null) =>
    pick === null || pickSpan(pick)[1] < (pick.kind === "row" ? table.rows.length : table.columns.length)
  const cellsFit = cells === null || cellRange(cells).rows[1] <= lastRow
  const pickedNow = fits(picked) ? picked : null
  const cellsNow = cellsFit && cells !== null && cellRange(cells).columns[1] <= lastColumn ? cells : null
  const scope: CellRange | null =
    pickedNow !== null
      ? pickedNow.kind === "row"
        ? { rows: pickSpan(pickedNow), columns: [0, lastColumn] }
        : { rows: [0, lastRow], columns: pickSpan(pickedNow) }
      : cellsNow === null
        ? null
        : cellRange(cellsNow)
  const scopeKey = selected && scope !== null ? JSON.stringify(scope) : ""
  useEffect(() => {
    onCells?.(id, scopeKey === "" ? null : (JSON.parse(scopeKey) as CellRange))
  }, [onCells, id, scopeKey])

  function pick(kind: TablePick["kind"], at: number | null, extend: boolean) {
    setCells(null)
    if (at === null) setPicked(null)
    else setPicked((now) => (extend && now?.kind === kind ? { ...now, to: at } : { kind, from: at, to: at }))
  }

  function pickCells(spot: Spot, extend: boolean) {
    setPicked(null)
    setCells((now) => ({ anchor: extend ? (now?.anchor ?? active ?? spot) : spot, to: spot }))
  }

  function pressed(event: PointerEvent<HTMLDivElement>) {
    press.current = null
    const spot = spotAt(event.target)
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey
    if (selected && plain && spot !== null && !sameSpot(active, spot)) {
      if (event.shiftKey) {
        event.preventDefault()
        pickCells(spot, true)
        focusTable()
        return
      }
      press.current = { spot, x: event.clientX, y: event.clientY }
    }
    moves.press(event, element, "move")
  }

  function clicked(event: { readonly clientX: number; readonly clientY: number }) {
    const at = press.current
    press.current = null
    if (at === null || Math.hypot(event.clientX - at.x, event.clientY - at.y) > clickSlop) return
    pickCells(at.spot, false)
  }

  function keyed(event: KeyboardEvent<HTMLDivElement>) {
    const onFrame = event.target === event.currentTarget
    const gesture = onFrame && cellsNow !== null ? gestureFor(event, "element") : null
    if (gesture === "delete" && cellsNow !== null) {
      event.preventDefault()
      change({ change: "clear", cells: cellRange(cellsNow) })
      return
    }
    if (onFrame && (cells !== null || picked !== null) && gestureFor(event, "element") === "deselect") {
      event.preventDefault()
      setCells(null)
      setPicked(null)
      return
    }
    moves.key(event, element)
  }

  function scopeTexts(range: CellRange): CellTexts {
    const [top, bottom] = range.rows
    const [left, right] = range.columns
    const kept = stored === null || stored === "moving" ? null : stored
    return table.rows.slice(top, bottom + 1).map((row, down) =>
      row.cells.slice(left, right + 1).map((cell, across) => {
        const held = kept?.rows[top + down]?.cells[left + across]
        return held === undefined ? plainText(cell.text) : cellText(held)
      }),
    )
  }

  function pastedIn(event: ClipboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !selected || scope === null) return
    const cells = readPastedCells(event.clipboardData)
    if (cells === null) return
    event.preventDefault()
    change({ change: "paste", row: scope.rows[0], column: scope.columns[0], cells })
  }

  function copiedOut(event: ClipboardEvent<HTMLDivElement>, cut: boolean) {
    if (event.target !== event.currentTarget || !selected || scope === null) return
    event.preventDefault()
    const texts = scopeTexts(scope)
    event.clipboardData.setData("text/plain", writeTabbed(texts))
    event.clipboardData.setData("text/html", tabbedHtml(texts))
    if (cut) change({ change: "clear", cells: scope })
  }

  const region =
    pickedNow !== null || (cellsNow !== null && !(active !== null && sameSpot(cellsNow.to, active))) ? scope : null
  const handles: TableHandles | null =
    !selected || words === undefined
      ? null
      : {
          table: shown,
          box,
          scaled,
          words,
          picked: pickedNow,
          region,
          onPick: pick,
          onSizing: setSizing,
          change,
          leave: focusTable,
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
        onFocus={() => {
          setActive(spot)
          setPicked(null)
          setCells({ anchor: spot, to: spot })
        }}
        onKey={(event) => key(spot, event)}
        onText={(text) => change({ change: "cell", row: at, column, text })}
        onCells={(cells) => change({ change: "paste", row: at, column, cells })}
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
          onPointerDown: pressed,
          onClick: clicked,
          onPaste: pastedIn,
          onCopy: (event) => copiedOut(event, false),
          onCut: (event) => copiedOut(event, true),
          onDoubleClick: (event) => moves.doubleClick(event, element),
          onKeyDown: keyed,
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
        onCells={props.onCells}
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
