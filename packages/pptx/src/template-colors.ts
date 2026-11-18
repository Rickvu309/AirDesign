import { decodedXmlText, spliceBytes, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { xmlAttribute } from "./shape-write.js"
import { markupChildren } from "./text-value-route.js"

export type ThemeCustomColor = { readonly name: string; readonly color: string }

const hex = /^[0-9A-F]{6}$/
const before = new Set(["a:themeElements", "a:objectDefaults", "a:extraClrSchemeLst"])

function named(element: MarkupElement | undefined, name: string): string | null {
  const held = element?.attributes.find((attribute) => attribute.name === name)
  return held === undefined ? null : decodedXmlText(held.value)
}

function plainColor(elements: readonly MarkupElement[], color: MarkupElement | undefined): string | null {
  if (color === undefined || (markupChildren(elements)[color.index]?.length ?? 0) > 0 || !color.selfClosing) return null
  const hex =
    color.kind === "a:srgbClr" ? named(color, "val") : color.kind === "a:sysClr" ? named(color, "lastClr") : null
  return hex !== null && /^[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null
}

function safeName(name: string): string {
  const text = xmlAttribute(name).replaceAll("'", "&apos;").trim()
  return text === "" ? "Color" : text
}

export function themeCustomColors(bytes: Uint8Array): readonly ThemeCustomColor[] | null {
  const { elements } = requireMarkup(bytes)
  const root = elements[0]
  if (root === undefined) return null
  const list = (markupChildren(elements)[root.index] ?? []).find((element) => element.kind === "a:custClrLst")
  if (list === undefined) return []
  const colors: ThemeCustomColor[] = []
  for (const item of markupChildren(elements)[list.index] ?? []) {
    if (item.kind !== "a:custClr") return null
    const [color, ...rest] = markupChildren(elements)[item.index] ?? []
    const value = rest.length > 0 ? null : plainColor(elements, color)
    const name = named(item, "name")
    if (value === null || name === null || !hex.test(value)) return null
    colors.push({ name: name.trim() === "" ? "Color" : name, color: value })
  }
  return colors
}

export function withThemeCustomColors(bytes: Uint8Array, colors: readonly ThemeCustomColor[]): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const root = elements[0]
  if (root === undefined) throw new Error("theme-custom")
  const children = markupChildren(elements)[root.index] ?? []
  const held = children.find((element) => element.kind === "a:custClrLst")
  const body = colors
    .map((color) => `<a:custClr name="${safeName(color.name)}"><a:srgbClr val="${color.color}"/></a:custClr>`)
    .join("")
  const next = body === "" ? new Uint8Array(0) : encodeUtf8(`<a:custClrLst>${body}</a:custClrLst>`)
  if (held !== undefined) return spliceBytes(bytes, [{ start: held.start, end: held.end, next }])
  if (body === "") return bytes
  let at = root.openEnd
  for (const child of children) {
    if (child.kind === "a:extLst") break
    if (before.has(child.kind)) at = child.end
  }
  if (root.selfClosing) {
    const open = decodeUtf8(bytes.subarray(root.start, root.openEnd - 2)).trimEnd()
    return spliceBytes(bytes, [
      { start: root.start, end: root.end, next: encodeUtf8(`${open}>${decodeUtf8(next)}</${root.kind}>`) },
    ])
  }
  return spliceBytes(bytes, [{ start: at, end: at, next }])
}
