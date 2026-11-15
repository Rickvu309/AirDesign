import { namesAlpha, type Alpha, type FieldValue } from "@airdesign/document"
import { alphaKept, colorsOf, fadedBytes, fadedFill, shownAlpha, type Faded } from "./alpha-codec.js"
import { insertChild, type ChildOf } from "./child-order.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { shownLine, type LineField } from "./line-read.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { openTag, slotRoot, withAttribute, withChild as childIn, type Slot } from "./slot-edit.js"
import { filledChild } from "./trait-xml-fill.js"
import { whole, type ElementAt, type FieldXml, type PartCodec, type Parts, type TraitXml } from "./xml-codec.js"

type LineChild = ChildOf<"a:ln">

type Arrow = FieldValue<"line", "head">

const empty = "<a:ln/>"
const fillTags = ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill", "a:grpFill"]
const dashTags = ["a:prstDash", "a:custDash"]
const joinTags = ["a:round", "a:bevel", "a:miter"]
const miterLimit = "800000"
const fadedKinds = ["a:solidFill", "a:gradFill", "a:pattFill"]

function lineChild(tags: readonly string[], tag: LineChild | null, element: string | null): Slot {
  return childIn("a:ln", tags, tag, element)
}

function lineEdited(parts: Parts, at: ElementAt, slot: Slot): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, at.shape)
  if (!isShapeTag(shape.kind) || shapeTags[shape.kind].properties !== "p:spPr") throw new Error("line-shape")
  const properties = elements.filter((each) => each.parent === shape.index && each.kind === "p:spPr")
  const host = properties[0]
  if (properties.length !== 1 || host === undefined) throw new Error("line-properties")
  const own = elements.find((each) => each.parent === host.index && each.kind === "a:ln")
  let edit: ByteEdit
  if (own !== undefined) {
    const line = bytes.subarray(own.start, own.end)
    const next = slot(line)
    if (sameBytes(next, line)) return parts
    edit = { start: own.start, end: own.end, next }
  } else {
    const next = decodeUtf8(slot(encodeUtf8(empty)))
    if (next === empty) return parts
    const parent = host.selfClosing
      ? `${openTag(bytes, host)}>${next}</p:spPr>`
      : insertChild("p:spPr", "a:ln", next, decodeUtf8(bytes.subarray(host.start, host.end)))
    edit = { start: host.start, end: host.end, next: encodeUtf8(parent) }
  }
  const changed = new Map(parts)
  changed.set(at.part, spliceBytes(bytes, [edit]))
  return changed
}

function arrowXml(tag: "a:headEnd" | "a:tailEnd", arrow: Arrow): string {
  return `<${tag} type="${arrow.type}" w="${arrow.width}" len="${arrow.length}"/>`
}

function codec<F extends LineField>(
  name: F,
  write: (value: FieldValue<"line", F>) => Slot,
): PartCodec<FieldValue<"line", F>> {
  return {
    read: (parts, at) => shownLine(parts, at)?.[name].value ?? null,
    write: (parts, at, value) => lineEdited(parts, at, write(value)),
  }
}

function field<F extends LineField>(
  name: F,
  write: (value: FieldValue<"line", F>) => Slot,
  inherit: Slot,
): FieldXml<FieldValue<"line", F>> {
  return whole(codec(name, write), (parts, at) => lineEdited(parts, at, inherit))
}

function filled(value: FieldValue<"line", "fill">): Slot {
  return filledChild("a:ln", fillTags, value)
}

export function lineAlpha(parts: Parts, at: ElementAt): Faded {
  const value = shownLine(parts, at)?.fill.value
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

function fadedLine(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const shown = shownLine(parts, at)?.fill
  const value = shown?.value
  if (shown === undefined || value == null || colorsOf(value).length === 0) return parts
  return lineEdited(parts, at, shown.own ? fadedChild(alpha) : filled(fadedFill(value, alpha)))
}

export const lineXml: TraitXml<"line"> = {
  slot: null,
  fields: {
    width: field("width", (value) => withAttribute("w", String(value)), withAttribute("w", null)),
    fill: whole(
      alphaKept(codec("fill", filled), lineAlpha, fadedLine, (value) => namesAlpha(colorsOf(value))),
      (parts, at) => lineEdited(parts, at, lineChild(fillTags, null, null)),
    ),
    dash: field(
      "dash",
      (value) => lineChild(dashTags, "a:prstDash", `<a:prstDash val="${value}"/>`),
      lineChild(dashTags, null, null),
    ),
    cap: field("cap", (value) => withAttribute("cap", value), withAttribute("cap", null)),
    compound: field("compound", (value) => withAttribute("cmpd", value), withAttribute("cmpd", null)),
    join: field(
      "join",
      (value) =>
        lineChild(joinTags, `a:${value}`, value === "miter" ? `<a:miter lim="${miterLimit}"/>` : `<a:${value}/>`),
      lineChild(joinTags, null, null),
    ),
    head: field(
      "head",
      (value) => lineChild(["a:headEnd"], "a:headEnd", arrowXml("a:headEnd", value)),
      lineChild(["a:headEnd"], null, null),
    ),
    tail: field(
      "tail",
      (value) => lineChild(["a:tailEnd"], "a:tailEnd", arrowXml("a:tailEnd", value)),
      lineChild(["a:tailEnd"], null, null),
    ),
    alpha: whole({
      read: (parts, at) => {
        const shown = lineAlpha(parts, at)
        return shown === "mixed" ? null : shown
      },
      write: fadedLine,
    }),
  },
}
