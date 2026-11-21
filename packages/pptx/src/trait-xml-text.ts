import { shownRunLink, writtenLink, type RelationshipsRead } from "./trait-xml-link.js"
import { writtenRunImage } from "./text-fill-write.js"
import {
  namesAlpha,
  opaque,
  readTextValue,
  writeTextValue,
  type Alpha,
  type Color,
  type TextValue,
} from "@airdesign/document"
import { agreed, alphaKept, fadedBytes, fragmentAlpha, type Faded } from "./alpha-codec.js"
import { fillIn } from "./color-read.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { child, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { presentationPart } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { drawnShape, type Sheet } from "./paint-sheet.js"
import { requireMarkup } from "./part-markup.js"
import { withRunFill } from "./run-color.js"
import { shapeById } from "./shape-tree.js"
import { applyRoute } from "./slide-route.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"
import { listLevels, ownersOf, sheetOf, textStyleKind } from "./trait-read.js"
import { whole as wholeField, type ElementAt, type PartCodec, type Parts, type TraitXml } from "./xml-codec.js"

type Layer = { readonly held: Held; readonly bytes: Uint8Array }

type Spot = {
  readonly run: MarkupElement
  readonly properties: MarkupElement | undefined
  readonly own: MarkupElement | undefined
  readonly inherited: Uint8Array | null
}

const runKinds: readonly string[] = ["a:r", "a:fld"]
const fadedKinds: readonly string[] = ["a:solidFill", "a:gradFill", "a:pattFill"]
const colorKinds: readonly string[] = ["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"]
const lastLevel = 8
const textColor = encodeUtf8('<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>')

function shownText(stored: string): TextValue {
  return readTextValue(stored) ?? [{ from: 0, runs: stored === "" ? [] : [{ from: 0, text: stored }] }]
}

function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

function sliceOf(layer: Layer, element: MarkupElement): Uint8Array {
  return layer.bytes.subarray(element.start, element.end)
}

function rootOf(bytes: Uint8Array): Held {
  const { elements } = requireMarkup(bytes)
  const root = elements[0]
  if (root === undefined) throw new Error("text-root")
  return { element: root, children: markupChildren(elements) }
}

function firstFill(layers: readonly Layer[]): Uint8Array | null {
  for (const layer of layers) {
    const fill = fillIn(layer.held)
    if (fill !== undefined) return sliceOf(layer, fill.element)
  }
  return null
}

function levelOf(properties: Held | undefined): number {
  const level = properties === undefined ? undefined : whole(properties.element, "lvl")
  return level === undefined || level < 0 || level > lastLevel ? 0 : level
}

function joined(chunks: readonly Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    merged.set(chunk, at)
    at += chunk.length
  }
  return merged
}

function runSpots(parts: Parts, at: ElementAt): { readonly bytes: Uint8Array; readonly spots: readonly Spot[] } | null {
  const item = drawnShape(parts, at.part, at.shape)
  if (item === null) return null
  const ownHeld: Held = { element: item.element, children: item.children }
  const body = child(ownHeld, "p:txBody")
  if (body === undefined) return { bytes: item.bytes, spots: [] }
  const paragraphs = inside(body).filter((each) => each.kind === "a:p")
  const active: { readonly paragraph: Held; readonly runs: readonly MarkupElement[] }[] = []
  for (const element of paragraphs) {
    const paragraph = { ...body, element }
    const runs = inside(paragraph).filter((each) => runKinds.includes(each.kind) && !each.selfClosing)
    if (runs.length > 0) active.push({ paragraph, runs })
  }
  if (active.length === 0) return { bytes: item.bytes, spots: [] }
  let loaded = false
  let layout: Sheet | null = null
  let master: Sheet | null = null
  let owners: readonly Held[] = [ownHeld]
  let presentation: Uint8Array | undefined
  let defaults: Held | undefined
  let styles: Held | undefined
  let referenced: Uint8Array | null = null
  const loadChain = () => {
    if (loaded) return
    loaded = true
    layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
    master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
    owners = ownersOf(item, { sheet: item, layout, master })
    presentation = parts.get(presentationPart)
    defaults = presentation === undefined ? undefined : child(rootOf(presentation), "p:defaultTextStyle")
    styles =
      master === null || master.elements[0] === undefined
        ? undefined
        : child(
            child({ element: master.elements[0], children: master.children }, "p:txStyles"),
            textStyleKind(item.placeholder?.type ?? null),
          )
    const reference = child(child(owners[0], "p:style"), "a:fontRef")
    const color = reference === undefined ? undefined : inside(reference).find((each) => colorKinds.includes(each.kind))
    referenced =
      color === undefined
        ? null
        : joined([
            encodeUtf8("<a:solidFill>"),
            item.bytes.subarray(color.start, color.end),
            encodeUtf8("</a:solidFill>"),
          ])
  }
  const bytesOf = (held: Held) =>
    (held.source === "layout" ? layout : held.source === "master" ? master : item)?.bytes ?? item.bytes
  const spots: Spot[] = []
  for (const { paragraph, runs } of active) {
    let inherited: Uint8Array | null | undefined
    const resolveInherited = (): Uint8Array | null => {
      if (inherited !== undefined) return inherited
      loadChain()
      const properties = child(paragraph, "a:pPr")
      const level = levelOf(properties)
      const own = child(properties, "a:defRPr")
      const near: Layer[] = [
        ...(own === undefined ? [] : [{ held: own, bytes: item.bytes }]),
        ...owners.flatMap((owner) =>
          listLevels(child(child(owner, "p:txBody"), "a:lstStyle"), level).map((held) => ({
            held,
            bytes: bytesOf(owner),
          })),
        ),
      ]
      const far: Layer[] = [
        ...(master === null ? [] : listLevels(styles, level).map((held) => ({ held, bytes: master!.bytes }))),
        ...(presentation === undefined
          ? []
          : listLevels(defaults, level).map((held) => ({ held, bytes: presentation! }))),
      ]
      inherited = firstFill(near) ?? referenced ?? firstFill(far) ?? textColor
      return inherited
    }
    for (const run of runs) {
      const held = child({ ...paragraph, element: run }, "a:rPr")
      const own = fillIn(held)?.element
      spots.push({ run, properties: held?.element, own, inherited: own === undefined ? resolveInherited() : null })
    }
  }
  return { bytes: item.bytes, spots }
}

export function textAlpha(parts: Parts, at: ElementAt): Faded {
  const found = runSpots(parts, at)
  if (found === null) return null
  return agreed(
    found.spots.map((spot) => {
      const fill = spot.own === undefined ? spot.inherited : found.bytes.subarray(spot.own.start, spot.own.end)
      if (fill === null) return null
      return fill === textColor ? (opaque as Alpha) : fragmentAlpha(fill)
    }),
  )
}

function fadedSpot(bytes: Uint8Array, spot: Spot, alpha: Alpha): ByteEdit | null {
  const { own, properties, inherited, run } = spot
  if (own !== undefined) {
    if (!fadedKinds.includes(own.kind)) return null
    return { start: own.start, end: own.end, next: fadedBytes(bytes.subarray(own.start, own.end), alpha) }
  }
  if (inherited === null || !fadedKinds.includes(rootOf(inherited).element.kind)) return null
  const fill = fadedBytes(inherited, alpha)
  if (properties === undefined)
    return { start: run.openEnd, end: run.openEnd, next: joined([encodeUtf8("<a:rPr>"), fill, encodeUtf8("</a:rPr>")]) }
  const next = withRunFill(bytes.subarray(properties.start, properties.end), fill)
  return { start: properties.start, end: properties.end, next }
}

function fadedText(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const found = runSpots(parts, at)
  if (found === null) return parts
  const edits = found.spots.flatMap((spot) => fadedSpot(found.bytes, spot, alpha) ?? [])
  if (edits.length === 0) return parts
  const changed = new Map(parts)
  changed.set(at.part, spliceBytes(found.bytes, edits))
  return changed
}

function runColors(stored: string): readonly Color[] {
  return shownText(stored).flatMap((paragraph) =>
    paragraph.runs.flatMap((run) => {
      const { fill } = run
      if (fill !== undefined) {
        if ("image" in fill) return []
        return "solid" in fill ? [fill.solid] : fill.gradient.stops.map((stop) => stop.color)
      }
      return run.color === undefined ? [] : [run.color]
    }),
  )
}

const textValue: PartCodec<string> = {
  read(parts, at) {
    const bytes = parts.get(at.part)
    if (bytes === undefined) return null
    try {
      const { elements } = requireMarkup(bytes)
      const children = markupChildren(elements)
      const shape = shapeById(elements, at.shape)
      const value = shapeTextValue(children, bytes, shape)
      const relationships: RelationshipsRead = new Map()
      return storedText(
        value.map((paragraph, i) => ({
          ...paragraph,
          runs: paragraph.runs.map((run, j) => {
            const link = shownRunLink(parts, at.part, bytes, children, shape, i, j, relationships)
            return link === null || link.kind === "none" ? run : { ...run, link }
          }),
        })),
      )
    } catch {
      return null
    }
  },
  write(parts, at, value) {
    const text = shownText(value)
    let next: Parts = applyRoute(parts, {
      name: "text",
      part: at.part,
      shape: at.shape,
      value: text,
      ...(at.numbers === undefined ? {} : { numbers: at.numbers }),
    })
    for (const [paragraph, p] of text.entries()) {
      let run = 0
      for (const r of p.runs) {
        if (r.link !== undefined && r.link.kind !== "unsupported")
          next = writtenLink(next, { ...at, paragraph, run }, r.link)
        if (r.fill !== undefined && "image" in r.fill)
          next = writtenRunImage(next, { ...at, paragraph, run }, r.fill.image)
        run += r.slideNumber?.count === "all" && r.slideNumber.format !== null ? 2 : 1
      }
    }
    return next
  },
}

export const textXml: TraitXml<"text"> = {
  slot: null,
  fields: {
    value: wholeField(alphaKept(textValue, textAlpha, fadedText, (value) => namesAlpha(runColors(value)))),
    alpha: wholeField({
      read: (parts, at) => {
        const shown = textAlpha(parts, at)
        return shown === "mixed" ? null : shown
      },
      write: fadedText,
    }),
  },
}
