import { sizeDefault, type CellRange, type TableValue, type TextValue } from "@airdesign/document"

export type ShownValue<T> = { readonly value: T; readonly mixed: boolean }

export type CellsShown = {
  readonly fill: ShownValue<unknown>
  readonly color: ShownValue<unknown>
  readonly size: ShownValue<number>
  readonly bold: ShownValue<boolean>
  readonly italic: ShownValue<boolean>
  readonly align: ShownValue<string>
}

function shownOf<T>(values: readonly T[], fallback: T): ShownValue<T> {
  const [first] = values
  if (first === undefined) return { value: fallback, mixed: false }
  const key = JSON.stringify(first)
  return { value: first, mixed: values.some((each) => JSON.stringify(each) !== key) }
}

function solidOf(fill: unknown): unknown {
  return typeof fill === "object" && fill !== null && "solid" in fill ? fill.solid : null
}

function pickedCells(table: TableValue, cells: CellRange): readonly { cell: TextValue; fill: unknown }[] {
  const [top, bottom] = cells.rows
  const [left, right] = cells.columns
  return table.rows
    .slice(top, bottom + 1)
    .flatMap((row) =>
      row.cells.slice(left, right + 1).map((cell, at) => ({ cell, fill: solidOf(row.fills?.[left + at]) })),
    )
}

export function cellsShown(table: TableValue, cells: CellRange): CellsShown {
  const picked = pickedCells(table, cells)
  const runs = picked.flatMap(({ cell }) => cell.flatMap((paragraph) => paragraph.runs))
  const paragraphs = picked.flatMap(({ cell }) => cell)
  return {
    fill: shownOf(
      picked.map(({ fill }) => fill),
      null,
    ),
    color: shownOf(
      runs.map((run) => run.color ?? null),
      null,
    ),
    size: shownOf(
      runs.map((run) => run.size ?? sizeDefault),
      sizeDefault,
    ),
    bold: shownOf(
      runs.map((run) => run.bold === true),
      false,
    ),
    italic: shownOf(
      runs.map((run) => run.italic === true),
      false,
    ),
    align: shownOf(
      paragraphs.map((paragraph) => paragraph.align ?? "left"),
      "left",
    ),
  }
}
