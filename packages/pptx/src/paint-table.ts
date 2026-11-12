import type { MarkupElement } from "./element-span.js"
import { paintAttribute, type PaintFill } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import type { PaintLine } from "./paint-shape.js"
import type { PaintPicture } from "./paint-image.js"
import { paintText, type PaintText, type PaintTextScope } from "./paint-text.js"
import {
  tableBorder,
  tableFill,
  tableFlag,
  tableLayers,
  tableLine,
  tableNumber,
  tableTextStyle,
  type TableStyle,
} from "./table-style.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintTableCell = {
  readonly gridSpan: number
  readonly rowSpan: number
  readonly hMerge: boolean
  readonly vMerge: boolean
  readonly fill: PaintFill | null
  readonly borders: Readonly<Record<"left" | "right" | "top" | "bottom", PaintLine | null>>
  readonly text: PaintText | null
}

export type PaintTable = {
  readonly columns: readonly number[]
  readonly rows: readonly { readonly height: number; readonly cells: readonly PaintTableCell[] }[]
}

export const tableIn = (element: MarkupElement, children: MarkupChildren): MarkupElement | undefined => {
  if (element.kind !== "p:graphicFrame") return undefined
  return paintChild(
    children,
    paintChild(children, paintChild(children, element, "a:graphic"), "a:graphicData"),
    "a:tbl",
  )
}

export const paintTable = (
  element: MarkupElement,
  children: MarkupChildren,
  bytes: Uint8Array,
  scope: () => PaintTextScope,
  styleOf: (properties: MarkupElement | undefined, children: MarkupChildren, bytes: Uint8Array) => TableStyle | null,
  picture: PaintPicture,
): PaintTable | undefined => {
  const table = tableIn(element, children)
  if (table === undefined) return undefined
  const properties = paintChild(children, table, "a:tblPr")
  const grid = paintChild(children, table, "a:tblGrid")
  const columns = (grid === undefined ? [] : (children[grid.index] ?? []))
    .filter((each) => each.kind === "a:gridCol")
    .map((each) => tableNumber(each, "w", 0))
  const rows = (children[table.index] ?? []).filter((each) => each.kind === "a:tr")
  const style = styleOf(properties, children, bytes)
  return {
    columns,
    rows: rows.map((row, at) => ({
      height: tableNumber(row, "h", 0),
      cells: (children[row.index] ?? [])
        .filter((each) => each.kind === "a:tc")
        .map((cell, column): PaintTableCell => {
          const cellProperties = paintChild(children, cell, "a:tcPr")
          const layers = tableLayers(style, properties, at)
          const gridSpan = Math.max(1, Math.min(tableNumber(cell, "gridSpan", 1), columns.length - column))
          const rowSpan = Math.max(1, Math.min(tableNumber(cell, "rowSpan", 1), rows.length - at))
          const text = paintText(
            { element: cell, children, bytes, placeholder: null, above: [], style: tableTextStyle(layers, scope()) },
            scope,
          )
          const inset = (name: string, standard: number) => {
            const value = cellProperties === undefined ? null : paintAttribute(cellProperties, name)
            return value !== null && /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value))
              ? Number(value)
              : standard
          }
          const anchor = cellProperties === undefined ? null : paintAttribute(cellProperties, "anchor")
          const border = (side: "left" | "right" | "top" | "bottom", tag: string, inside: boolean) => {
            const line = paintChild(children, cellProperties, tag)
            return line === undefined ? tableBorder(layers, side, inside, scope()) : tableLine(line, children, scope())
          }
          const ownFill =
            cellProperties === undefined
              ? undefined
              : children[cellProperties.index]?.find((each) =>
                  ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill"].includes(each.kind),
                )
          return {
            gridSpan,
            rowSpan,
            hMerge: tableFlag(cell, "hMerge"),
            vMerge: tableFlag(cell, "vMerge"),
            fill:
              ownFill === undefined
                ? tableFill(layers, scope())
                : paintFill(ownFill, children, scope().palette, picture, true),
            borders: {
              left: border("left", "a:lnL", column > 0),
              right: border("right", "a:lnR", column + gridSpan < columns.length),
              top: border("top", "a:lnT", at > 0),
              bottom: border("bottom", "a:lnB", at + rowSpan < rows.length),
            },
            text:
              text === null
                ? null
                : {
                    ...text,
                    anchor: anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top",
                    insets: {
                      left: inset("marL", 91440),
                      right: inset("marR", 91440),
                      top: inset("marT", 45720),
                      bottom: inset("marB", 45720),
                    },
                  },
          }
        }),
    })),
  }
}
