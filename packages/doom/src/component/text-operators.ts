import { type Text, textStyleNames } from "../index.js"
import { finite, integer, literal, naming, object } from "../read-kit.js"
import type { ReportFinding } from "./findings.js"
import { type FittingContext, measureText, textSize } from "./fit-text.js"
import { type Value, type Values, numeric, record, string, valueList } from "./values.js"

const styleOf = literal(textStyleNames)
const dimension = finite(0, 1_000_000)

function naturalText(chars: string, style: Text["style"], size: number): Text {
  return {
    chars,
    style,
    spans: chars === "" ? [] : [{ end: chars.length, size }],
    paras: chars.split("\n").map(() => ({ align: "left" })),
    resize: "fixed",
    alignV: "center",
    wrap: "none",
  }
}

export function textWidth([raw, styleArg, sizeArg]: Values, context: FittingContext): number {
  const chars = naming("[1]", () => string(raw))
  const style = naming("[2]", () => styleOf(styleArg))
  const size = sizeArg === undefined ? context.theme.textStyles[style].size : naming("[3]", () => textSize(sizeArg))
  return numeric(measureText(naturalText(chars, style, size), context).w)
}

const flowOptions = object({
  width: dimension,
  rows: integer(0, 100),
  rowHeight: dimension,
  leading: dimension,
  gap: dimension,
  style: styleOf,
  smaller: textSize,
})

type FlowItem = { readonly item: Value; readonly chars: string }

function pack(
  items: readonly FlowItem[],
  options: ReturnType<typeof flowOptions>,
  size: number,
  context: FittingContext,
) {
  const placed: Value[] = []
  const omitted: number[] = []
  let end = 0
  let row = 0
  let crowded = false
  for (const [index, { item, chars }] of items.entries()) {
    context.charge(1 + chars.length)
    if (options.rows === 0 || chars.trim() === "" || chars.includes("\n")) {
      omitted.push(index)
      continue
    }
    const measured = measureText(naturalText(chars, options.style, size), context)
    const w = Math.ceil(numeric(measured.w))
    const width = options.leading + w
    if (width > options.width || numeric(measured.h) > options.rowHeight || measured.lines.length > 1) {
      crowded = true
      omitted.push(index)
      continue
    }
    let x = placed.length === 0 ? 0 : end + options.gap
    if (x + width > options.width) {
      if (row + 1 >= options.rows) {
        crowded = true
        omitted.push(index)
        continue
      }
      row += 1
      x = 0
    }
    placed.push({ item, x, row, w })
    end = x + width
  }
  return { items: placed, rows: placed.length === 0 ? 0 : row + 1, size, omitted, crowded }
}

export function flowText([source, settings]: Values, context: FittingContext, report: ReportFinding): Value {
  const options = naming("[2]", () => flowOptions(settings))
  const items = naming("[1]", () =>
    valueList(source).map((item, i) =>
      naming(`[${i}]`, () => {
        context.charge()
        return { item, chars: naming("chars", () => string(record(item).chars)) }
      }),
    ),
  )
  const full = context.theme.textStyles[options.style].size
  const natural = pack(items, options, full, context)
  const smaller = Math.min(options.smaller, full)
  const result = natural.crowded && smaller < full ? pack(items, options, smaller, context) : natural
  if (result.omitted.length > 0) report({ kind: "flow-omitted", omitted: result.omitted })
  return { items: result.items, rows: result.rows, size: result.size }
}
