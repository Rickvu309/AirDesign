import type { Color, FieldValue } from "@airdesign/document"
import { insertChild, type ChildOf } from "./child-order.js"
import { colorXml } from "./color-xml.js"
import { effectsSlot, shownEffects, type EffectsField } from "./effects-read.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { whole, type ElementAt, type FieldXml, type Parts, type TraitXml } from "./xml-codec.js"

type Effect = ChildOf<"a:effectLst">

type List = (list: string) => string

const empty = "<a:effectLst/>"

function rootOf(bytes: Uint8Array): MarkupElement {
  const root = requireMarkup(bytes).elements[0]
  if (root === undefined) throw new Error("effects")
  return root
}

function openTag(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - (element.selfClosing ? 2 : 1))).trimEnd()
}

function effectOf(list: Uint8Array, tag: Effect): MarkupElement | undefined {
  const { elements } = requireMarkup(list)
  const root = rootOf(list)
  return elements.find((each) => each.parent === root.index && each.kind === tag)
}

function without(tag: Effect): List {
  return (text) => {
    const list = encodeUtf8(text)
    const found = effectOf(list, tag)
    if (found === undefined) return text
    const next = spliceBytes(list, [{ start: found.start, end: found.end, next: new Uint8Array() }])
    const root = rootOf(next)
    const bare = requireMarkup(next).elements.every((each) => each.parent !== root.index)
    return bare ? `${openTag(next, root)}/>` : decodeUtf8(next)
  }
}

function added(tag: Effect, element: string): List {
  return (text) => {
    const list = encodeUtf8(text)
    const root = rootOf(list)
    if (root.selfClosing) return `${openTag(list, root)}>${element}</a:effectLst>`
    return insertChild("a:effectLst", tag, element, text)
  }
}

function attributeEdits(element: MarkupElement, values: Readonly<Record<string, string>>): ByteEdit[] {
  const edits: ByteEdit[] = []
  let appended = ""
  for (const [name, text] of Object.entries(values)) {
    const attribute = element.attributes.find((each) => each.name === name)
    if (attribute === undefined) appended += ` ${name}="${text}"`
    else edits.push({ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(text) })
  }
  if (appended === "") return edits
  const named = element.attributes.at(-1)
  const at = named === undefined ? element.start + 1 + element.kind.length : named.valueEnd + 1
  return [...edits, { start: at, end: at, next: encodeUtf8(appended) }]
}

const colorTags = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])

function patched(tag: Effect, values: Readonly<Record<string, string>>, color: Color | null, fresh: string): List {
  return (text) => {
    const list = encodeUtf8(text)
    const found = effectOf(list, tag)
    if (found === undefined) return added(tag, fresh)(text)
    const { elements } = requireMarkup(list)
    const edits = attributeEdits(found, values)
    const shade = elements.find((each) => each.parent === found.index && colorTags.has(each.kind))
    if (color !== null && shade !== undefined)
      edits.push({ start: shade.start, end: shade.end, next: encodeUtf8(colorXml(color)) })
    else if (color !== null && found.selfClosing)
      edits.push({ start: found.openEnd - 2, end: found.end, next: encodeUtf8(`>${colorXml(color)}</${tag}>`) })
    else if (color !== null) edits.push({ start: found.openEnd, end: found.openEnd, next: encodeUtf8(colorXml(color)) })
    return decodeUtf8(spliceBytes(list, edits))
  }
}

function hostOf(bytes: Uint8Array, shapeId: string): MarkupElement {
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, shapeId)
  const tag = isShapeTag(shape.kind) ? shapeTags[shape.kind].properties : null
  const hosts = elements.filter((each) => each.parent === shape.index && each.kind === tag)
  const host = hosts[0]
  if (tag === null || hosts.length !== 1 || host === undefined) throw new Error("effects-properties")
  return host
}

function effectsEdited(parts: Parts, at: ElementAt, edit: List): Parts {
  const slot = effectsSlot(parts, at)
  if (slot === null || slot.dag) return parts
  const bytes = partBytes(parts, at.part)
  const host = hostOf(bytes, at.shape)
  const { elements } = requireMarkup(bytes)
  const own = elements.find((each) => each.parent === host.index && each.kind === "a:effectLst")
  let change: ByteEdit
  if (own !== undefined) {
    const text = decodeUtf8(bytes.subarray(own.start, own.end))
    const next = edit(text)
    if (next === text) return parts
    change = { start: own.start, end: own.end, next: encodeUtf8(next) }
  } else {
    const inherited = slot.bytes()
    const next = edit(inherited === null ? empty : decodeUtf8(inherited))
    const parent = host.selfClosing
      ? `${openTag(bytes, host)}>${next}</${host.kind}>`
      : insertChild(
          host.kind as "p:spPr" | "p:grpSpPr",
          "a:effectLst",
          next,
          decodeUtf8(bytes.subarray(host.start, host.end)),
        )
    change = { start: host.start, end: host.end, next: encodeUtf8(parent) }
  }
  const next = spliceBytes(bytes, [change])
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}

function shadowList(value: FieldValue<"effects", "shadow">): List {
  if ("none" in value) return without("a:outerShdw")
  const { blur, distance, direction, color } = value.outer
  const values = { blurRad: String(blur), dist: String(distance), dir: String(direction) }
  const fresh = `<a:outerShdw blurRad="${blur}" dist="${distance}" dir="${direction}" rotWithShape="0">${colorXml(color)}</a:outerShdw>`
  return patched("a:outerShdw", values, color, fresh)
}

function glowList(value: FieldValue<"effects", "glow">): List {
  if ("none" in value) return without("a:glow")
  const { radius, color } = value.halo
  return patched("a:glow", { rad: String(radius) }, color, `<a:glow rad="${radius}">${colorXml(color)}</a:glow>`)
}

function softEdgeList(value: FieldValue<"effects", "softEdge">): List {
  if ("none" in value) return without("a:softEdge")
  return patched("a:softEdge", { rad: String(value.radius) }, null, `<a:softEdge rad="${value.radius}"/>`)
}

function field<F extends EffectsField>(
  name: F,
  list: (value: FieldValue<"effects", F>) => List,
): FieldXml<FieldValue<"effects", F>> {
  return whole({
    read: (parts, at) => shownEffects(parts, at)?.[name].value ?? null,
    write: (parts, at, value) => effectsEdited(parts, at, list(value)),
  })
}

export const effectsXml: TraitXml<"effects"> = {
  slot: null,
  fields: {
    shadow: field("shadow", shadowList),
    glow: field("glow", glowList),
    softEdge: field("softEdge", softEdgeList),
  },
}
