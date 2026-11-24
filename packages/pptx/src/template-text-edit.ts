import { spliceBytes, type MarkupElement } from "./element-span.js"
import { deckLayouts } from "./deck-layouts.js"
import { linkedPart } from "./notes-part.js"
import { encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { withAttribute } from "./slot-edit.js"
import { xmlAttribute } from "./shape-write.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { Parts } from "./xml-codec.js"

export type TemplateTextEdit = {
  readonly id: string
  readonly size: number
  readonly font: string
}

const masterId = /^(ppt\/slideMasters\/slideMaster\d+\.xml)\/(title|body|other)Style\/([0-8])$/
const layoutId = /^(ppt\/slideLayouts\/slideLayout\d+\.xml)\/([^/]+)\/([0-8])$/

function masterFor(parts: Parts, theme: string): string | null {
  const found = deckLayouts(parts)
    .map((layout) => linkedPart(parts, layout.part, "slideMaster"))
    .find((master) => master !== null && linkedPart(parts, master, "theme") === theme)
  return found ?? null
}

function parsed(bytes: Uint8Array): { readonly elements: readonly MarkupElement[]; readonly kids: MarkupChildren } {
  const { elements } = requireMarkup(bytes)
  return { elements, kids: markupChildren(elements) }
}

function child(kids: MarkupChildren, parent: MarkupElement, kind: string): MarkupElement | undefined {
  return kids[parent.index]?.find((element) => element.kind === kind)
}

function levelTag(level: number): string {
  return `a:lvl${String(level + 1)}pPr`
}

function styleElement(bytes: Uint8Array, role: string): MarkupElement {
  const { elements, kids } = parsed(bytes)
  const styles = elements.find((element) => element.kind === "p:txStyles")
  const style = styles === undefined ? undefined : child(kids, styles, `p:${role}Style`)
  if (style === undefined) throw new Error("text-style")
  return style
}

function levelElement(bytes: Uint8Array, role: string, level: number): MarkupElement | undefined {
  const { kids } = parsed(bytes)
  return child(kids, styleElement(bytes, role), levelTag(level))
}

function defaultsElement(bytes: Uint8Array, role: string, level: number): MarkupElement | undefined {
  const levelHeld = levelElement(bytes, role, level)
  if (levelHeld === undefined) return undefined
  return child(parsed(bytes).kids, levelHeld, "a:defRPr")
}

function inserted(bytes: Uint8Array, host: MarkupElement, inner: string, at: number): Uint8Array {
  if (!host.selfClosing) return spliceBytes(bytes, [{ start: at, end: at, next: encodeUtf8(inner) }])
  const open = host.openEnd - 2
  return spliceBytes(bytes, [{ start: open, end: host.end, next: encodeUtf8(`>${inner}</${host.kind}>`) }])
}

function placed(bytes: Uint8Array, host: MarkupElement, tag: string, inner: string): Uint8Array {
  const kids = parsed(bytes).kids[host.index] ?? []
  const later = kids.find((element) => element.kind.startsWith("a:lvl") && element.kind > tag)
  const trailing = kids.find((element) => element.kind !== "a:defPPr" && !element.kind.startsWith("a:lvl"))
  const boundary = later ?? trailing
  return inserted(bytes, host, inner, boundary === undefined ? host.closeStart : boundary.start)
}

function defaultsShell(size: number, font: string): string {
  return `<a:defRPr sz="${String(size)}"><a:latin typeface="${xmlAttribute(font)}"/></a:defRPr>`
}

function shell(level: number, size: number, font: string): string {
  const tag = levelTag(level)
  return `<${tag}>${defaultsShell(size, font)}</${tag}>`
}

function ensureLevel(bytes: Uint8Array, role: string, level: number, size: number, font: string): Uint8Array {
  if (levelElement(bytes, role, level) !== undefined) return bytes
  return placed(bytes, styleElement(bytes, role), levelTag(level), shell(level, size, font))
}

function ensureDefaults(bytes: Uint8Array, role: string, level: number, size: number, font: string): Uint8Array {
  const held = levelElement(bytes, role, level)
  if (held === undefined || defaultsElement(bytes, role, level) !== undefined) return bytes
  return inserted(bytes, held, defaultsShell(size, font), held.openEnd)
}

function attributeOn(bytes: Uint8Array, element: MarkupElement, name: string, value: string): Uint8Array {
  const next = withAttribute(name, value)(bytes.subarray(element.start, element.end))
  return spliceBytes(bytes, [{ start: element.start, end: element.end, next }])
}

function withSize(bytes: Uint8Array, role: string, level: number, size: number): Uint8Array {
  const held = defaultsElement(bytes, role, level)
  if (held === undefined) throw new Error("text-style")
  return attributeOn(bytes, held, "sz", String(size))
}

function withFont(bytes: Uint8Array, role: string, level: number, font: string): Uint8Array {
  const held = defaultsElement(bytes, role, level)
  if (held === undefined) throw new Error("text-style")
  const latin = child(parsed(bytes).kids, held, "a:latin")
  const face = xmlAttribute(font)
  if (latin !== undefined) return attributeOn(bytes, latin, "typeface", face)
  return inserted(bytes, held, `<a:latin typeface="${face}"/>`, held.openEnd)
}

function writtenRole(bytes: Uint8Array, role: string, level: number, size: number, font: string): Uint8Array {
  const ready = ensureDefaults(ensureLevel(bytes, role, level, size, font), role, level, size, font)
  return withFont(withSize(ready, role, level, size), role, level, font)
}

function replaced(parts: Parts, part: string, bytes: Uint8Array): Parts {
  const next = new Map(parts)
  next.set(part, bytes)
  return next
}

function shapeElement(bytes: Uint8Array, shape: string): MarkupElement | undefined {
  const { elements } = parsed(bytes)
  const identity = elements.find(
    (element) =>
      element.kind === "p:cNvPr" &&
      element.attributes.some((attribute) => attribute.name === "id" && attribute.value === shape),
  )
  if (identity === undefined) return undefined
  return elements.find((element) => {
    const shapeKind =
      element.kind === "p:sp" ||
      element.kind === "p:pic" ||
      element.kind === "p:cxnSp" ||
      element.kind === "p:graphicFrame"
    return shapeKind && element.start <= identity.start && element.end >= identity.end
  })
}

function bodyOf(bytes: Uint8Array, shape: MarkupElement): MarkupElement | undefined {
  return child(parsed(bytes).kids, shape, "p:txBody")
}

function ensureList(bytes: Uint8Array, shape: string): Uint8Array {
  const owner = shapeElement(bytes, shape)
  const body = owner === undefined ? undefined : bodyOf(bytes, owner)
  if (body === undefined) throw new Error("text-style")
  if (child(parsed(bytes).kids, body, "a:lstStyle") !== undefined) return bytes
  const properties = child(parsed(bytes).kids, body, "a:bodyPr")
  const at = properties === undefined ? body.openEnd : properties.end
  return inserted(bytes, body, "<a:lstStyle/>", at)
}

function listElement(bytes: Uint8Array, shape: string): MarkupElement {
  const owner = shapeElement(bytes, shape)
  const body = owner === undefined ? undefined : bodyOf(bytes, owner)
  const list = body === undefined ? undefined : child(parsed(bytes).kids, body, "a:lstStyle")
  if (list === undefined) throw new Error("text-style")
  return list
}

function listLevel(bytes: Uint8Array, shape: string, level: number): MarkupElement | undefined {
  return child(parsed(bytes).kids, listElement(bytes, shape), levelTag(level))
}

function listDefaults(bytes: Uint8Array, shape: string, level: number): MarkupElement | undefined {
  const held = listLevel(bytes, shape, level)
  if (held === undefined) return undefined
  return child(parsed(bytes).kids, held, "a:defRPr")
}

function writtenList(bytes: Uint8Array, shape: string, level: number, size: number, font: string): Uint8Array {
  const withList = ensureList(bytes, shape)
  const withLevel =
    listLevel(withList, shape, level) === undefined
      ? placed(withList, listElement(withList, shape), levelTag(level), shell(level, size, font))
      : withList
  const held = listLevel(withLevel, shape, level)
  const withDefaults =
    held === undefined || listDefaults(withLevel, shape, level) !== undefined
      ? withLevel
      : inserted(withLevel, held, defaultsShell(size, font), held.openEnd)
  const defaults = listDefaults(withDefaults, shape, level)
  if (defaults === undefined) throw new Error("text-style")
  const sized = attributeOn(withDefaults, defaults, "sz", String(size))
  const nextDefaults = listDefaults(sized, shape, level)
  if (nextDefaults === undefined) throw new Error("text-style")
  const latin = child(parsed(sized).kids, nextDefaults, "a:latin")
  const face = xmlAttribute(font)
  if (latin !== undefined) return attributeOn(sized, latin, "typeface", face)
  return inserted(sized, nextDefaults, `<a:latin typeface="${face}"/>`, nextDefaults.openEnd)
}

function paragraphLevel(element: MarkupElement, kids: MarkupChildren): number {
  const properties = child(kids, element, "a:pPr")
  const level = properties?.attributes.find((attribute) => attribute.name === "lvl")?.value
  const number = level === undefined ? 0 : Number(level)
  return Number.isInteger(number) && number >= 0 && number <= 8 ? number : 0
}

function paragraphsOf(bytes: Uint8Array, shape: string): readonly MarkupElement[] {
  const owner = shapeElement(bytes, shape)
  const body = owner === undefined ? undefined : bodyOf(bytes, owner)
  if (body === undefined) return []
  return parsed(bytes).kids[body.index]?.filter((element) => element.kind === "a:p") ?? []
}

function writtenParagraphs(bytes: Uint8Array, shape: string, level: number, size: number, font: string): Uint8Array {
  let next = bytes
  const total = paragraphsOf(next, shape).length
  for (let index = 0; index < total; index += 1) {
    const viewed = parsed(next)
    const current = paragraphsOf(next, shape)[index]
    if (current === undefined || paragraphLevel(current, viewed.kids) !== level) continue
    const properties = child(viewed.kids, current, "a:pPr")
    if (properties === undefined) continue
    const defaults = child(viewed.kids, properties, "a:defRPr")
    if (defaults === undefined) continue
    const sized = attributeOn(next, defaults, "sz", String(size))
    const again = parsed(sized)
    const paragraph = paragraphsOf(sized, shape)[index]
    const held = paragraph === undefined ? undefined : child(again.kids, paragraph, "a:pPr")
    const rewritten = held === undefined ? undefined : child(again.kids, held, "a:defRPr")
    if (rewritten === undefined) continue
    const latin = child(again.kids, rewritten, "a:latin")
    const face = xmlAttribute(font)
    next =
      latin === undefined
        ? inserted(sized, rewritten, `<a:latin typeface="${face}"/>`, rewritten.openEnd)
        : attributeOn(sized, latin, "typeface", face)
  }
  return next
}

function writtenLayout(bytes: Uint8Array, shape: string, level: number, size: number, font: string): Uint8Array {
  return writtenParagraphs(writtenList(bytes, shape, level, size, font), shape, level, size, font)
}

export function writeTemplateTextEdits(parts: Parts, theme: string, edits: readonly TemplateTextEdit[]): Parts {
  let next = parts
  const master = masterFor(next, theme)
  for (const edit of edits) {
    if (!Number.isInteger(edit.size) || edit.size <= 0) throw new Error("text-style")
    const onMaster = masterId.exec(edit.id)
    if (onMaster !== null) {
      if (master === null || onMaster[1] !== master || onMaster[2] === undefined || onMaster[3] === undefined) continue
      const bytes = partBytes(next, master)
      next = replaced(next, master, writtenRole(bytes, onMaster[2], Number(onMaster[3]), edit.size, edit.font))
      continue
    }
    const onLayout = layoutId.exec(edit.id)
    if (onLayout === null || onLayout[1] === undefined || onLayout[2] === undefined || onLayout[3] === undefined)
      throw new Error("text-style")
    const owner = linkedPart(next, onLayout[1], "slideMaster")
    if (owner === null || linkedPart(next, owner, "theme") !== theme) continue
    next = replaced(
      next,
      onLayout[1],
      writtenLayout(partBytes(next, onLayout[1]), onLayout[2], Number(onLayout[3]), edit.size, edit.font),
    )
  }
  return next
}
