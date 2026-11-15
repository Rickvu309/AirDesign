import {
  dashPresets,
  tableSides,
  widestLine,
  type Border,
  type Borders,
  type CellFill,
  type TableRow,
  type TableSide,
} from "@airdesign/document"
import { fillIn } from "./color-read.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { fillValueOf } from "./fill-read.js"
import { child, whole, type Held } from "./markup-held.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup } from "./part-markup.js"
import { slotRoot, withAttribute, withChild, type Slot } from "./slot-edit.js"
import { cellsOf, type Grid } from "./table-grid.js"
import { filledChild } from "./trait-xml-fill.js"

export type CellRead = { readonly fill: CellFill | null; readonly borders: Borders }

type SideTag = "a:lnL" | "a:lnR" | "a:lnT" | "a:lnB"

const sideTags: Readonly<Record<TableSide, SideTag>> = { left: "a:lnL", right: "a:lnR", top: "a:lnT", bottom: "a:lnB" }
const fillTags = ["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"]
const dashTags = ["a:prstDash", "a:custDash"]

function fillOf(held: Held | undefined): CellFill | null {
  const fill = fillIn(held)
  const value = fill === undefined ? null : fillValueOf(fill, null)
  return value === null || "group" in value || "picture" in value ? null : value
}

function borderOf(line: Held): Border {
  const width = whole(line.element, "w")
  const fill = fillOf(line)
  const preset = child(line, "a:prstDash")
  const dash =
    preset === undefined ? undefined : dashPresets.find((each) => each === paintAttribute(preset.element, "val"))
  return {
    ...(width === undefined || width < 0 || width > widestLine ? {} : { width }),
    ...(fill === null ? {} : { fill }),
    ...(dash === undefined ? {} : { dash }),
  }
}

export function cellRead(grid: Grid, cell: MarkupElement): CellRead {
  const properties = child({ element: cell, children: grid.children }, "a:tcPr")
  const borders: Partial<Record<TableSide, Border>> = {}
  for (const side of tableSides) {
    const line = child(properties, sideTags[side])
    const border = line === undefined ? {} : borderOf(line)
    if (Object.keys(border).length > 0) borders[side] = border
  }
  return { fill: fillOf(properties), borders }
}

function same(left: unknown, right: unknown): boolean {
  const sorted = (value: unknown): unknown =>
    typeof value !== "object" || value === null
      ? value
      : Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
        )
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function borderSlot(tag: SideTag, wanted: Border, shown: Border | undefined): Slot | null {
  const slots: Slot[] = []
  if (wanted.width !== undefined && wanted.width !== shown?.width) slots.push(withAttribute("w", String(wanted.width)))
  if (wanted.fill !== undefined && !same(wanted.fill, shown?.fill)) {
    slots.push(filledChild(tag, fillTags, wanted.fill))
  }
  if (wanted.dash !== undefined && wanted.dash !== shown?.dash)
    slots.push(withChild(tag, dashTags, "a:prstDash", `<a:prstDash val="${wanted.dash}"/>`))
  return slots.length === 0 ? null : (line) => slots.reduce((next, slot) => slot(next), line)
}

function withSide(tag: SideTag, patch: Slot): Slot {
  return (properties) => {
    const { elements } = requireMarkup(properties)
    const root = slotRoot(properties)
    const own = elements.find((each) => each.parent === root.index && each.kind === tag)
    const line = own === undefined ? encodeUtf8(`<${tag}/>`) : properties.subarray(own.start, own.end)
    return withChild("a:tcPr", [tag], tag, decodeUtf8(patch(line)))(properties)
  }
}

function propertiesSlot(row: TableRow, column: number, shown: CellRead): Slot | null {
  const slots: Slot[] = []
  const borders = row.borders?.[column] ?? null
  for (const side of tableSides) {
    const wanted = borders?.[side]
    const patch = wanted === undefined ? null : borderSlot(sideTags[side], wanted, shown.borders[side])
    if (patch !== null) slots.push(withSide(sideTags[side], patch))
  }
  const fill = row.fills?.[column] ?? null
  if (fill !== null && !same(fill, shown.fill)) {
    slots.push(filledChild("a:tcPr", fillTags, fill))
  }
  return slots.length === 0 ? null : (properties) => slots.reduce((next, slot) => slot(next), properties)
}

function cellEdit(grid: Grid, bytes: Uint8Array, cell: MarkupElement, slot: Slot): ByteEdit | null {
  const kids = grid.children[cell.index] ?? []
  const own = kids.find((each) => each.kind === "a:tcPr")
  if (own !== undefined) {
    const before = bytes.subarray(own.start, own.end)
    const next = slot(before)
    return sameBytes(next, before) ? null : { start: own.start, end: own.end, next }
  }
  const next = slot(encodeUtf8("<a:tcPr/>"))
  const body = kids.find((each) => each.kind === "a:txBody")
  const at = body === undefined ? cell.openEnd : body.end
  return decodeUtf8(next) === "<a:tcPr/>" ? null : { start: at, end: at, next }
}

export function cellEdits(grid: Grid, bytes: Uint8Array, rows: readonly TableRow[]): Uint8Array | null {
  const edits = grid.rows.flatMap((element, at) => {
    const row = rows[at]
    if (row === undefined || (row.fills === undefined && row.borders === undefined)) return []
    return cellsOf(grid, element).flatMap((cell, column) => {
      const slot = propertiesSlot(row, column, cellRead(grid, cell))
      const edit = slot === null ? null : cellEdit(grid, bytes, cell, slot)
      return edit === null ? [] : [edit]
    })
  })
  return edits.length === 0 ? null : spliceBytes(bytes, edits)
}
