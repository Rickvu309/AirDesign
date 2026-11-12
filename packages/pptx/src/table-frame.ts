import { markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import type { ShapeBox } from "./shape-write.js"

export type TableShape = ShapeBox & { readonly rows: number; readonly columns: number }

const tableUri = "http://schemas.openxmlformats.org/drawingml/2006/table"
const edge = '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>'
const edges = ["lnL", "lnR", "lnT", "lnB"].map((side) => `<a:${side} w="12700">${edge}</a:${side}>`).join("")

function shares(total: number, count: number): readonly number[] {
  if (!Number.isSafeInteger(total) || !Number.isInteger(count) || total < count || count < 1) throw new Error("a:tbl")
  const each = Math.floor(total / count)
  return Array.from({ length: count }, (_, at) => each + (at < total % count ? 1 : 0))
}

export function defaultTableStyle(parts: ReadonlyMap<string, Uint8Array>): string | null {
  const bytes = parts.get("ppt/tableStyles.xml")
  if (bytes === undefined) return null
  const { elements, wellFormed } = markupDocument(bytes)
  const list = elements.find((element) => element.kind === "a:tblStyleLst" && element.parent < 0)
  const wanted = list === undefined || !wellFormed ? null : paintAttribute(list, "def")
  if (wanted === null || !/^\{[0-9A-Fa-f-]{36}\}$/.test(wanted)) return null
  const styles = elements.filter((element) => element.kind === "a:tblStyle" && element.parent === list?.index)
  return styles.some((style) => paintAttribute(style, "styleId")?.toUpperCase() === wanted.toUpperCase())
    ? wanted
    : null
}

export function tableFrame(id: number, shape: TableShape, style: string | null): string {
  const widths = shares(shape.cx, shape.columns)
  const heights = shares(shape.cy, shape.rows)
  const properties =
    style === null
      ? "<a:tblPr/>"
      : `<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${style}</a:tableStyleId></a:tblPr>`
  const cell = `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></a:txBody><a:tcPr>${style === null ? edges : ""}</a:tcPr></a:tc>`
  const grid = widths.map((width) => `<a:gridCol w="${width}"/>`).join("")
  const rows = heights.map((height) => `<a:tr h="${height}">${cell.repeat(shape.columns)}</a:tr>`).join("")
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${shape.x}" y="${shape.y}"/><a:ext cx="${shape.cx}" cy="${shape.cy}"/></p:xfrm><a:graphic><a:graphicData uri="${tableUri}"><a:tbl>${properties}<a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}
