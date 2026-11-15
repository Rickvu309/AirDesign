import type { ShapeBox } from "./shape-write.js"

export type TableShape = ShapeBox & { readonly rows: number; readonly columns: number }

const tableUri = "http://schemas.openxmlformats.org/drawingml/2006/table"

function shares(total: number, count: number): readonly number[] {
  if (!Number.isSafeInteger(total) || !Number.isInteger(count) || total < count || count < 1) throw new Error("a:tbl")
  const each = Math.floor(total / count)
  return Array.from({ length: count }, (_, at) => each + (at < total % count ? 1 : 0))
}

export function tableFrame(id: number, shape: TableShape, style: string): string {
  const widths = shares(shape.cx, shape.columns)
  const heights = shares(shape.cy, shape.rows)
  const properties = `<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${style}</a:tableStyleId></a:tblPr>`
  const cell = `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></a:txBody><a:tcPr/></a:tc>`
  const grid = widths.map((width) => `<a:gridCol w="${width}"/>`).join("")
  const rows = heights.map((height) => `<a:tr h="${height}">${cell.repeat(shape.columns)}</a:tr>`).join("")
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${shape.x}" y="${shape.y}"/><a:ext cx="${shape.cx}" cy="${shape.cy}"/></p:xfrm><a:graphic><a:graphicData uri="${tableUri}"><a:tbl>${properties}<a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}
