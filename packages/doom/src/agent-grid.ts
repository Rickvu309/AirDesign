import type { AgentChange } from "./agent-change.js"
import {
  type Block,
  type Part,
  boxIn,
  emit,
  frameOf,
  heightIn,
  ladderOf,
  partOf,
  strokeOf,
  wordsFit,
} from "./agent-block.js"
import { type Draft, type Values, stop } from "./agent-draft.js"
import { sidesOf, surfaceOf, turnOf } from "./agent-look.js"
import { gapFor, patternArea, slideSize, themeOf } from "./agent-place.js"
import type { Node } from "./doom.js"
import { isBlankValue, isDataValue, numberValue } from "./number-values.js"
import type { Paint, Sides } from "./paint.js"
import type { Text, TextStyleName } from "./text.js"

type Add = Extract<AgentChange, { op: "add" }>

type CellLook = {
  readonly bold: boolean
  readonly font: string
  readonly right: boolean
  readonly tabular: boolean
  readonly padding: Sides
}

function cellText(part: Part, look: CellLook): Part {
  const { chars, spans, paras } = part.text
  const open = spans.length === 0 ? [{ end: chars.length }] : spans
  const text: Text = {
    ...part.text,
    spans: open.map((span) => ({
      ...span,
      bold: span.bold ?? look.bold,
      font: span.font ?? look.font,
      ...(look.tabular ? { figures: "tabular" as const } : {}),
    })),
    paras: look.right ? paras.map((para) => ({ ...para, align: "right" as const })) : paras,
    padding: look.padding,
  }
  const values = part.block.values as Values
  return { ...part, text, block: { ...part.block, values: { ...values, text } } }
}

const totalLabel = /^(?:grand\s+)?total\b/iu
const headerRule = 2
const rowRule = 1
const rowRuleInk: Paint = { kind: "solid", color: { var: "text", tint: 0.8 } }
const headerRuleInk: Paint = { kind: "solid", color: { var: "text" } }

function ruleOf(row: number, last: number, total: boolean, columns: number): Block[] {
  const side =
    row === 0 && last > 0
      ? { sides: { b: headerRule }, weight: headerRule, ink: headerRuleInk }
      : total && row === last
        ? { sides: { t: headerRule }, weight: headerRule, ink: headerRuleInk }
        : row === last || (total && row === last - 1)
          ? undefined
          : { sides: { b: rowRule }, weight: rowRule, ink: rowRuleInk }
  if (side === undefined) return []
  return [
    {
      type: "shape",
      values: {
        name: "Rule",
        geometry: { kind: "rect" },
        sizing: { w: "fill", h: "fill" },
        cell: { row, col: 0, colSpan: columns },
        strokes: [side.ink],
        stroke: { ...strokeOf(side.weight), align: "inside", sides: side.sides },
      },
    },
  ]
}

function numberColumn(plain: readonly (readonly string[])[], col: number): boolean {
  const body = plain.slice(1).map((row) => row[col] ?? "")
  return (
    col > 0 && body.some(isDataValue) && body.every((cell) => isBlankValue(cell) || numberValue(cell) !== undefined)
  )
}

export function addGrid(draft: Draft, parent: Node, change: Add): void {
  const rows =
    change.rows ??
    stop(
      "shape",
      undefined,
      "rows",
      "missing",
      "One row or more, each with one cell or more. An empty string leaves a cell empty.",
    )
  if (rows.length === 0 || rows.some((row) => row.length === 0))
    stop("shape", undefined, "rows", "form", "One row or more, each with one cell or more.")
  if (change.layout !== undefined) stop("shape", undefined, "layout", "needs", "rows to place the grid")
  const area = patternArea(draft, parent, change.box)
  const theme = themeOf(draft)
  const gap = gapFor(slideSize(draft).w)
  const columns = Math.max(...rows.map((row) => row.length))
  const last = rows.length - 1
  const plain = rows.map((row) => row.map((cell) => (cell === "" ? "" : partOf(cell, "body").text.chars)))
  const total = last > 1 && totalLabel.test(plain[last]![0]?.trim() ?? "")
  const numbers = Array.from({ length: columns }, (_, col) => numberColumn(plain, col))
  const width = area.w / columns
  const paddingAt = (row: number, col: number): Sides => ({
    t: row === 0 ? 0 : Math.floor(gap / 2),
    r: col === columns - 1 ? 0 : Math.floor(gap / 2),
    b: row === last ? 0 : gap - Math.floor(gap / 2),
    l: col === 0 ? 0 : Math.ceil(gap / 2),
  })
  const roomAt = (row: number, col: number) => {
    const padding = paddingAt(row, col)
    return width - padding.l - padding.r
  }
  const ladder = ladderOf(theme)
  const steps = ladder.slice(ladder.indexOf("heading"), ladder.indexOf("caption") + 1)
  const attempt = (style: TextStyleName) => {
    const bold = (at: number, col: number) => at === 0 || col === 0 || (total && at === last)
    const whole = rows.every((row, at) =>
      row.every((cell, col) => wordsFit([cell], theme, style, roomAt(at, col), bold(at, col))),
    )
    if (!whole) return undefined
    const cells = rows.map((row, at) =>
      Array.from({ length: columns }, (_, col) => {
        const cell = row[col] ?? ""
        return cell === ""
          ? undefined
          : cellText(partOf(cell, style, at === 0 ? "text2" : "text"), {
              bold: bold(at, col),
              font: theme.fonts.body,
              right: numbers[col] === true,
              tabular: numbers[col] === true && at > 0 && numberValue(plain[at]?.[col] ?? "") !== undefined,
              padding: paddingAt(at, col),
            })
      }),
    )
    const heights = cells.map((row) =>
      Math.max(0, ...row.map((part) => (part === undefined ? 0 : heightIn(part, theme, width)))),
    )
    const tall = heights.reduce((sum, high) => sum + high, 0)
    if (tall > area.h) return undefined
    return frameOf(
      {
        ...surfaceOf(change),
        name: change.name ?? "Grid",
        box: { ...boxIn(area, change.box !== undefined ? area.h : tall), ...turnOf(change) },
        layout: {
          mode: "grid",
          columns: Array.from({ length: columns }, () => ({ fr: 1 })),
          rows: rows.map(() => "hug" as const),
          gap: 0,
          padding: sidesOf(0),
        },
      },
      cells.flatMap((row, r) => [
        ...ruleOf(r, last, total, columns),
        ...row.flatMap((part, c): Block[] => {
          if (part === undefined) return []
          const values = part.block.values as Values
          const text: Text = { ...(values.text as Text), alignV: r === 0 ? "bottom" : "center" }
          return [
            { ...part.block, values: { ...values, sizing: { w: "fill", h: "fill" }, cell: { row: r, col: c }, text } },
          ]
        }),
      ]),
    )
  }
  const block =
    steps.reduce<Block | undefined>((got, style) => got ?? attempt(style), undefined) ??
    stop("limit", undefined, "items", "needs", "shorter labels, fewer columns or fewer rows")
  emit(draft, parent.id, block)
}
