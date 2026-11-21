import { namesAlpha, type Alpha, type FieldValue } from "@airdesign/document"
import { alphaKept, colorsOf, fadedBytes, fadedFill, shownAlpha, type Faded } from "./alpha-codec.js"
import { insertChildAt, type ChildOf } from "./child-order.js"
import { writeDash } from "./dash-markup.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { shownBorderField, type BorderField } from "./border-read.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { openTag, slotRoot, withAttribute, withChild as childIn, type Slot } from "./slot-edit.js"
import { filledChild } from "./fill-markup.js"
import { markupChildren } from "./text-value-route.js"
import { whole, type ElementAt, type FieldXml, type PartCodec, type Parts, type TraitXml } from "./xml-codec.js"

type LineChild = ChildOf<"a:ln">

type Arrow = FieldValue<"border", "head">

const empty = "<a:ln/>"
const fillTags = ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill", "a:grpFill"]
const joinTags = ["a:round", "a:bevel", "a:miter"]
const miterLimit = "800000"
const fadedKinds = ["a:solidFill", "a:gradFill", "a:pattFill"]

function borderChild(tags: readonly string[], tag: LineChild | null, element: string | null): Slot {
  return childIn("a:ln", tags, tag, element)
}

function borderEdited(parts: Parts, at: ElementAt, slot: Slot): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  if (!isShapeTag(shape.kind) || shapeTags[shape.kind].properties !== "p:spPr") throw new Error("border-shape")
  const properties = (children[shape.index] ?? []).filter((each) => each.kind === "p:spPr")
  const host = properties[0]
  if (properties.length !== 1 || host === undefined) throw new Error("border-properties")
  const hostChildren = children[host.index] ?? []
  const own = hostChildren.find((each) => each.kind === "a:ln")
  let edit: ByteEdit
  if (own !== undefined) {
    const line = bytes.subarray(own.start, own.end)
    const next = slot(line)
    if (sameBytes(next, line)) return parts
    edit = { start: own.start, end: own.end, next }
  } else {
    const next = slot(encodeUtf8(empty))
    if (decodeUtf8(next) === empty) return parts
    if (host.selfClosing) {
      edit = {
        start: host.start,
        end: host.end,
        next: encodeUtf8(`${openTag(bytes, host)}>${decodeUtf8(next)}</p:spPr>`),
      }
    } else {
      const spot = insertChildAt("p:spPr", "a:ln", host, hostChildren)
      edit = { start: spot, end: spot, next }
    }
  }
  const changed = new Map(parts)
  changed.set(at.part, spliceBytes(bytes, [edit]))
  return changed
}

function arrowXml(tag: "a:headEnd" | "a:tailEnd", arrow: Arrow): string {
  return `<${tag} type="${arrow.type}" w="${arrow.width}" len="${arrow.length}"/>`
}

function codec<F extends BorderField>(
  name: F,
  write: (value: FieldValue<"border", F>) => Slot,
): PartCodec<FieldValue<"border", F>> {
  return {
    read: (parts, at) => shownBorderField(parts, at, name)?.value ?? null,
    write: (parts, at, value) => borderEdited(parts, at, write(value)),
  }
}

function field<F extends BorderField>(
  name: F,
  write: (value: FieldValue<"border", F>) => Slot,
  inherit: Slot,
): FieldXml<FieldValue<"border", F>> {
  return whole(codec(name, write), (parts, at) => borderEdited(parts, at, inherit))
}

function filled(value: FieldValue<"border", "fill">): Slot {
  return filledChild("a:ln", fillTags, value)
}

export function borderAlpha(parts: Parts, at: ElementAt): Faded {
  const value = shownBorderField(parts, at, "fill")?.value
  return value == null ? null : shownAlpha(colorsOf(value))
}

function fadedChild(alpha: Alpha): Slot {
  return (line) => {
    const { elements } = requireMarkup(line)
    const root = slotRoot(line)
    const own = elements.find((each) => each.parent === root.index && fadedKinds.includes(each.kind))
    if (own === undefined) return line
    const next = fadedBytes(line.subarray(own.start, own.end), alpha)
    return spliceBytes(line, [{ start: own.start, end: own.end, next }])
  }
}

function fadedBorder(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const shown = shownBorderField(parts, at, "fill")
  const value = shown?.value
  if (shown === undefined || shown === null || value == null || colorsOf(value).length === 0) return parts
  return borderEdited(parts, at, shown.own ? fadedChild(alpha) : filled(fadedFill(value, alpha)))
}

export const borderXml: TraitXml<"border"> = {
  slot: null,
  fields: {
    width: field("width", (value) => withAttribute("w", String(value)), withAttribute("w", null)),
    fill: whole(
      alphaKept(codec("fill", filled), borderAlpha, fadedBorder, (value) => namesAlpha(colorsOf(value))),
      (parts, at) => borderEdited(parts, at, borderChild(fillTags, null, null)),
    ),
    dash: field("dash", (value) => writeDash("a:ln", value), writeDash("a:ln", null)),
    cap: field("cap", (value) => withAttribute("cap", value), withAttribute("cap", null)),
    compound: field("compound", (value) => withAttribute("cmpd", value), withAttribute("cmpd", null)),
    join: field(
      "join",
      (value) =>
        borderChild(joinTags, `a:${value}`, value === "miter" ? `<a:miter lim="${miterLimit}"/>` : `<a:${value}/>`),
      borderChild(joinTags, null, null),
    ),
    head: field(
      "head",
      (value) => borderChild(["a:headEnd"], "a:headEnd", arrowXml("a:headEnd", value)),
      borderChild(["a:headEnd"], null, null),
    ),
    tail: field(
      "tail",
      (value) => borderChild(["a:tailEnd"], "a:tailEnd", arrowXml("a:tailEnd", value)),
      borderChild(["a:tailEnd"], null, null),
    ),
    alpha: whole({
      read: (parts, at) => {
        const shown = borderAlpha(parts, at)
        return shown === "mixed" ? null : shown
      },
      write: fadedBorder,
    }),
  },
}
