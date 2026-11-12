import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import type { CanvasLine, CanvasTable, CanvasText, PaintBox } from "./record.js"
import { SheetText } from "./sheet-text.js"
import { anchored, textLook, type Scaled } from "./text-look.js"

export type Cell = CanvasTable["rows"][number]["cells"][number]

export type CellEditor = (cell: Cell, row: number, column: number) => ReactNode

function Border(props: {
  readonly line: CanvasLine | null
  readonly points: readonly (number | string)[]
  readonly scaled: Scaled
}) {
  const { line, points, scaled } = props
  if (line === null) return null
  const weight = scaled(line.width)
  return (
    <line
      x1={points[0]}
      y1={points[1]}
      x2={points[2]}
      y2={points[3]}
      stroke={line.color}
      strokeWidth={weight}
      {...(line.dash === null ? {} : { strokeDasharray: line.dash.map((step) => step * weight).join(" ") })}
    />
  )
}

export function cellTextFrame(text: CanvasText, scaled: Scaled): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: anchored[text.anchor],
    padding: `${scaled(text.insets.top)}px ${scaled(text.insets.right)}px ${scaled(text.insets.bottom)}px ${scaled(text.insets.left)}px`,
  }
}

function CellArt(props: {
  readonly cell: Cell
  readonly scaled: Scaled
  readonly row: number
  readonly column: number
  readonly edit?: CellEditor | undefined
}) {
  const { cell, scaled, row, column, edit } = props
  const text = cell.text
  const look = text === null ? null : textLook(text, scaled)
  return (
    <div
      role="cell"
      aria-colindex={column + 1}
      aria-colspan={cell.gridSpan}
      aria-rowspan={cell.rowSpan}
      data-table-cell={`${row}.${column}`}
      style={{
        position: "relative",
        gridColumn: `${column + 1} / span ${cell.gridSpan}`,
        gridRow: `${row + 1} / span ${cell.rowSpan}`,
        minWidth: 0,
        display: "flex",
        ...(cell.fill === null ? {} : { background: cell.fill }),
      }}
    >
      {edit !== undefined ? (
        edit(cell, row, column)
      ) : text === null ? null : (
        <div style={cellTextFrame(text, scaled)}>
          <SheetText text={text} look={{ ...look!, body: { ...look!.body, minHeight: undefined } }} />
        </div>
      )}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
      >
        <Border line={cell.borders.left} points={[0, 0, 0, "100%"]} scaled={scaled} />
        <Border line={cell.borders.right} points={["100%", 0, "100%", "100%"]} scaled={scaled} />
        <Border line={cell.borders.top} points={[0, 0, "100%", 0]} scaled={scaled} />
        <Border line={cell.borders.bottom} points={[0, "100%", "100%", "100%"]} scaled={scaled} />
      </svg>
    </div>
  )
}

export function TableArt(props: {
  readonly table: CanvasTable
  readonly box: PaintBox | null
  readonly scaled: Scaled
  readonly style: CSSProperties
  readonly elementKey: string
  readonly edit?: CellEditor
  readonly frame?: HTMLAttributes<HTMLDivElement>
  readonly children?: ReactNode
}) {
  const { table, box, scaled, edit } = props
  const width = table.columns.reduce((sum, column) => sum + column, 0)
  const height = table.rows.reduce((sum, row) => sum + row.height, 0)
  const sx = (value: number) => scaled(width === 0 ? 0 : (value * (box?.width ?? width)) / width)
  const sy = (value: number) => scaled(height === 0 ? 0 : (value * (box?.height ?? height)) / height)
  return (
    <div
      data-canvas-element={props.elementKey}
      data-canvas-table
      role="table"
      aria-rowcount={table.rows.length}
      aria-colcount={table.columns.length}
      contentEditable={false}
      {...props.frame}
      style={{
        ...props.style,
        display: "grid",
        height: "auto",
        minHeight: sy(height),
        gridTemplateColumns: table.columns.map((column) => `${sx(column)}px`).join(" "),
        gridTemplateRows: table.rows.map((row) => `minmax(${sy(row.height)}px, auto)`).join(" "),
      }}
    >
      {table.rows.map((row, at) => (
        <div role="row" aria-rowindex={at + 1} key={at} style={{ display: "contents" }}>
          {row.cells.map((cell, column) => {
            if (cell.hMerge || cell.vMerge) return null
            return <CellArt key={column} cell={cell} row={at} column={column} scaled={scaled} edit={edit} />
          })}
        </div>
      ))}
      {props.children}
    </div>
  )
}
