import type { MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup, within } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type Grid = {
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
  readonly table: MarkupElement
  readonly offset: number
  readonly columns: number
  readonly widths: readonly MarkupElement[]
  readonly rows: readonly MarkupElement[]
  readonly merged: boolean
}

const mergeNames = ["gridSpan", "rowSpan", "hMerge", "vMerge"]

export function owned(
  children: MarkupChildren,
  parent: MarkupElement | undefined,
  kind: string,
): readonly MarkupElement[] {
  return parent === undefined ? [] : (children[parent.index] ?? []).filter((element) => element.kind === kind)
}

export function gridOf(bytes: Uint8Array, shape: string): Grid {
  const { elements } = requireMarkup(bytes)
  const frame = shapeById(elements, shape)
  const table = elements.find((element) => element.kind === "a:tbl" && within(elements, element, frame))
  if (frame.kind !== "p:graphicFrame" || table === undefined) throw new Error("a:tbl")
  const children = markupChildren(elements)
  const rows = owned(children, table, "a:tr")
  const widths = owned(children, owned(children, table, "a:tblGrid")[0], "a:gridCol")
  const columns = widths.length
  const merged = rows.some((row) => {
    const cells = owned(children, row, "a:tc")
    return (
      cells.length !== columns || cells.some((cell) => mergeNames.some((name) => paintAttribute(cell, name) !== null))
    )
  })
  const first = rows[0]
  const offset =
    first === undefined
      ? 0
      : elements.filter((element) => element.kind === "a:tr" && element.start < first.start).length
  return { elements, children, table, offset, columns, widths, rows, merged }
}

export function cellsOf(grid: Grid, row: MarkupElement): readonly MarkupElement[] {
  return owned(grid.children, row, "a:tc")
}
