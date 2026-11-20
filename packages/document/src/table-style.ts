import type { Color } from "./color.js"
import type { ParagraphAlign, TextValue } from "./text-value.js"

export type CellStyle = {
  readonly bold?: boolean
  readonly italic?: boolean
  readonly size?: number
  readonly color?: Color
  readonly align?: ParagraphAlign
}

export function styledCell(cell: TextValue, style: CellStyle): TextValue {
  const { align, ...run } = style
  return cell.map((paragraph) => ({
    ...paragraph,
    ...(align === undefined ? {} : { align }),
    runs: paragraph.runs.map((each) => ({ ...each, ...run })),
  }))
}
