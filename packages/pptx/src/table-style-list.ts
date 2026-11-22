import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { contentTypesPart, presentationPart, presentationRels } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { link, linkedPart, typed } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { replacePart, requireMarkup } from "./part-markup.js"
import type { PartTouch } from "./slide-touch.js"

type Parts = ReadonlyMap<string, Uint8Array>

export const officeTableStyle = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"

const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const stylesType = "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"
const thin = (side: string) =>
  `<a:${side}><a:ln w="12700" cmpd="sng"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln></a:${side}>`
const filled = (tint: string) =>
  `<a:fill><a:solidFill>${tint === "" ? '<a:schemeClr val="accent1"/>' : `<a:schemeClr val="accent1"><a:tint val="${tint}"/></a:schemeClr>`}</a:solidFill></a:fill>`
const banded = `<a:tcStyle><a:tcBdr/>${filled("40000")}</a:tcStyle>`
const plain = "<a:tcStyle><a:tcBdr/></a:tcStyle>"
const strong = (color: string) =>
  `<a:tcTxStyle${color === "lt1" ? ' b="on"' : ""}><a:fontRef idx="minor"><a:prstClr val="black"/></a:fontRef><a:schemeClr val="${color}"/></a:tcTxStyle>`
const edge = (side: string) =>
  `<a:tcBdr><a:${side}><a:ln w="38100" cmpd="sng"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln></a:${side}></a:tcBdr>`
const column = `${strong("lt1")}<a:tcStyle><a:tcBdr/>${filled("")}</a:tcStyle>`

export const officeTableStyleXml = [
  `<a:tblStyle styleId="${officeTableStyle}" styleName="Medium Style 2 - Accent 1">`,
  `<a:wholeTbl>${strong("dk1")}<a:tcStyle><a:tcBdr>${["left", "right", "top", "bottom", "insideH", "insideV"].map(thin).join("")}</a:tcBdr>${filled("20000")}</a:tcStyle></a:wholeTbl>`,
  `<a:band1H>${banded}</a:band1H><a:band2H>${plain}</a:band2H><a:band1V>${banded}</a:band1V><a:band2V>${plain}</a:band2V>`,
  `<a:lastCol>${column}</a:lastCol><a:firstCol>${column}</a:firstCol>`,
  `<a:lastRow>${strong("lt1")}<a:tcStyle>${edge("top")}${filled("")}</a:tcStyle></a:lastRow>`,
  `<a:firstRow>${strong("lt1")}<a:tcStyle>${edge("bottom")}${filled("")}</a:tcStyle></a:firstRow>`,
  "</a:tblStyle>",
].join("")

function stylesPart(parts: Parts): string {
  return linkedPart(parts, presentationPart, "tableStyles") ?? "ppt/tableStyles.xml"
}

function styleList(bytes: Uint8Array | undefined): { list: MarkupElement; styles: readonly string[] } | null {
  if (bytes === undefined) return null
  const { elements, wellFormed } = markupDocument(bytes)
  const list = elements.find((element) => element.kind === "a:tblStyleLst" && element.parent < 0)
  if (list === undefined || !wellFormed) return null
  const styles = elements
    .filter((element) => element.kind === "a:tblStyle" && element.parent === list.index)
    .map((style) => (paintAttribute(style, "styleId") ?? "").toUpperCase())
  return { list, styles }
}

export function defaultTableStyle(parts: Parts): string | null {
  const found = styleList(parts.get(stylesPart(parts)))
  const wanted = found === null ? null : paintAttribute(found.list, "def")
  if (found === null || wanted === null || !/^\{[0-9A-Fa-f-]{36}\}$/.test(wanted)) return null
  return found.styles.includes(wanted.toUpperCase()) ? wanted : null
}

function heldStyle(parts: Parts): string | null {
  const own = defaultTableStyle(parts)
  if (own !== null) return own
  return styleList(parts.get(stylesPart(parts)))?.styles.includes(officeTableStyle) === true ? officeTableStyle : null
}

export function tableStyleTouch(parts: Parts): PartTouch {
  if (heldStyle(parts) !== null) return { changed: [], added: [], removed: [] }
  const part = stylesPart(parts)
  if (parts.has(part)) return { changed: [part], added: [], removed: [] }
  return { changed: [contentTypesPart, presentationRels], added: [part], removed: [] }
}

export function newTableStyle(parts: Map<string, Uint8Array>): string {
  const held = heldStyle(parts)
  if (held !== null) return held
  const part = stylesPart(parts)
  const bytes = parts.get(part)
  if (bytes === undefined) {
    const list = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<a:tblStyleLst xmlns:a="${drawing}" def="${officeTableStyle}">${officeTableStyleXml}</a:tblStyleLst>`
    typed(parts, part, stylesType)
    link(parts, presentationPart, "tableStyles", part)
    parts.set(part, encodeUtf8(list))
    return officeTableStyle
  }
  const list = requireMarkup(bytes).elements.find((element) => element.kind === "a:tblStyleLst" && element.parent < 0)
  if (list === undefined) throw new Error("a:tblStyleLst")
  const edit = list.selfClosing
    ? { start: list.end - 2, end: list.end, next: encodeUtf8(`>${officeTableStyleXml}</a:tblStyleLst>`) }
    : { start: list.closeStart, end: list.closeStart, next: encodeUtf8(officeTableStyleXml) }
  replacePart(parts, part, spliceBytes(bytes, [edit]))
  return officeTableStyle
}

export const tableTextUri = "{9B4E2A71-3C5D-4F86-A1B0-6D2E8F4C7A53}"

export type TableCellLook = { readonly size: number; readonly middle: boolean }

export function tableCellLook(parts: Parts, style: string): TableCellLook | null {
  const bytes = parts.get(stylesPart(parts))
  if (bytes === undefined) return null
  const { elements } = markupDocument(bytes)
  const held = elements.find(
    (element) =>
      element.kind === "a:tblStyle" && (paintAttribute(element, "styleId") ?? "").toUpperCase() === style.toUpperCase(),
  )
  if (held === undefined) return null
  const inside = (parent: MarkupElement, kind: string) =>
    elements.find((element) => element.parent === parent.index && element.kind === kind)
  const list = inside(held, "a:extLst")
  const extension =
    list === undefined
      ? undefined
      : elements.find((element) => element.parent === list.index && paintAttribute(element, "uri") === tableTextUri)
  const text = extension === undefined ? undefined : inside(extension, "ad:cellText")
  const size = text === undefined ? null : paintAttribute(text, "sz")
  if (text === undefined || size === null || !/^[1-9]\d{2,5}$/.test(size)) return null
  return { size: Number(size), middle: paintAttribute(text, "anchor") === "ctr" }
}
