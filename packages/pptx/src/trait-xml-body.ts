import type { FieldValue } from "@airdesign/document"
import { fitTags, insetNames, shownBody, type BodyField } from "./body-read.js"
import { insertChild } from "./child-order.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { inTurn, withAttribute, withChild, type Slot } from "./slot-edit.js"
import { whole, type ElementAt, type FieldXml, type PartCodec, type Parts, type TraitXml } from "./xml-codec.js"

const empty = "<a:bodyPr/>"
const fits = Object.values(fitTags)

function bodyEdited(parts: Parts, at: ElementAt, slot: Slot): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, at.shape)
  const host = elements.find((each) => each.parent === shape.index && each.kind === "p:txBody")
  if (host === undefined || host.selfClosing) throw new Error("body-text")
  const own = elements.find((each) => each.parent === host.index && each.kind === "a:bodyPr")
  let edit: ByteEdit
  if (own !== undefined) {
    const frame = bytes.subarray(own.start, own.end)
    const next = slot(frame)
    if (sameBytes(next, frame)) return parts
    edit = { start: own.start, end: own.end, next }
  } else {
    const next = decodeUtf8(slot(encodeUtf8(empty)))
    const parent = insertChild("p:txBody", "a:bodyPr", next, decodeUtf8(bytes.subarray(host.start, host.end)))
    edit = { start: host.start, end: host.end, next: encodeUtf8(parent) }
  }
  const changed = new Map(parts)
  changed.set(at.part, spliceBytes(bytes, [edit]))
  return changed
}

function codec<F extends BodyField>(
  name: F,
  write: (value: FieldValue<"body", F>) => Slot,
): PartCodec<FieldValue<"body", F>> {
  return {
    read: (parts, at) => shownBody(parts, at)?.[name].value ?? null,
    write: (parts, at, value) => bodyEdited(parts, at, write(value)),
  }
}

function field<F extends BodyField>(
  name: F,
  write: (value: FieldValue<"body", F>) => Slot,
  inherit: Slot,
): FieldXml<FieldValue<"body", F>> {
  return whole(codec(name, write), (parts, at) => bodyEdited(parts, at, inherit))
}

function attribute<F extends BodyField>(name: F, xml: string, text: (value: FieldValue<"body", F>) => string) {
  return field(name, (value) => withAttribute(xml, text(value)), withAttribute(xml, null))
}

const sides = Object.entries(insetNames) as readonly (readonly [keyof typeof insetNames, string])[]

export const bodyXml: TraitXml<"body"> = {
  slot: null,
  fields: {
    insets: field(
      "insets",
      (value) => inTurn(...sides.map(([side, name]) => withAttribute(name, String(value[side])))),
      inTurn(...sides.map(([, name]) => withAttribute(name, null))),
    ),
    anchor: attribute("anchor", "anchor", (value) => value),
    wrap: attribute("wrap", "wrap", (value) => (value ? "square" : "none")),
    autofit: field(
      "autofit",
      (value) => withChild("a:bodyPr", fits, fitTags[value], `<${fitTags[value]}/>`),
      withChild("a:bodyPr", fits, null, null),
    ),
    vertical: attribute("vertical", "vert", (value) => value),
    columns: attribute("columns", "numCol", (value) => String(value)),
  },
}
