import type { FieldEdit, FieldValue, TraitPatch } from "@airdesign/document"
import { bodyFieldFrom, bodyLevels, fitTags, insetNames, type BodyField } from "./body-read.js"
import { insertChildAt } from "./child-order.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { inTurn, withAttribute, withAttributes, withChild, type Slot } from "./slot-edit.js"
import { markupChildren } from "./text-value-route.js"
import { whole, type ElementAt, type FieldXml, type PartCodec, type Parts, type TraitXml } from "./xml-codec.js"

const empty = "<a:bodyPr/>"
const fits = Object.values(fitTags)

export function bodyEdited(parts: Parts, at: ElementAt, slot: Slot): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  const host = children[shape.index]?.find((each) => each.kind === "p:txBody")
  if (host === undefined || host.selfClosing) throw new Error("body-text")
  const hostChildren = children[host.index] ?? []
  const own = hostChildren.find((each) => each.kind === "a:bodyPr")
  let edit: ByteEdit
  if (own !== undefined) {
    const frame = bytes.subarray(own.start, own.end)
    const next = slot(frame)
    if (sameBytes(next, frame)) return parts
    edit = { start: own.start, end: own.end, next }
  } else {
    const next = slot(encodeUtf8(empty))
    const spot = insertChildAt("p:txBody", "a:bodyPr", host, hostChildren)
    edit = { start: spot, end: spot, next }
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
    read: (parts, at) => {
      const levels = bodyLevels(parts, at)
      return levels === null ? null : bodyFieldFrom(levels, name).value
    },
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

const sides = Object.entries(insetNames) as readonly (readonly [keyof typeof insetNames, string])[]

const insetsWrite = (value: FieldValue<"body", "insets">): Slot =>
  withAttributes(sides.map(([side, name]) => [name, String(value[side])] as const))
const insetsInherit: Slot = withAttributes(sides.map(([, name]) => [name, null] as const))
const anchorWrite = (value: FieldValue<"body", "anchor">): Slot => withAttribute("anchor", value)
const anchorInherit: Slot = withAttribute("anchor", null)
const wrapWrite = (value: FieldValue<"body", "wrap">): Slot => withAttribute("wrap", value ? "square" : "none")
const wrapInherit: Slot = withAttribute("wrap", null)
const autofitWrite = (value: FieldValue<"body", "autofit">): Slot =>
  withChild("a:bodyPr", fits, fitTags[value], `<${fitTags[value]}/>`)
const autofitInherit: Slot = withChild("a:bodyPr", fits, null, null)
const verticalWrite = (value: FieldValue<"body", "vertical">): Slot => withAttribute("vert", value)
const verticalInherit: Slot = withAttribute("vert", null)
const columnsWrite = (value: FieldValue<"body", "columns">): Slot => withAttribute("numCol", String(value))
const columnsInherit: Slot = withAttribute("numCol", null)

function sameInsets(left: FieldValue<"body", "insets"> | null, right: FieldValue<"body", "insets">): boolean {
  return (
    left !== null &&
    left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom
  )
}

export function writtenBody(parts: Parts, at: ElementAt, patch: TraitPatch<"body">): Parts {
  const edits = patch as Readonly<Record<BodyField, FieldEdit<unknown> | undefined>>
  const active = (["insets", "anchor", "wrap", "autofit", "vertical", "columns"] as const).filter((name) => {
    const edit = edits[name]
    return edit !== undefined && edit !== "opening"
  })
  if (active.length === 0) return parts
  const needsRead = active.some((name) => edits[name] !== "inherit")
  const levels = needsRead ? bodyLevels(parts, at) : null
  const slots: Slot[] = []
  for (const name of active) {
    const edit = edits[name]
    if (edit === undefined || edit === "opening") continue
    if (name === "insets") {
      if (edit === "inherit") slots.push(insetsInherit)
      else if (
        !sameInsets(
          levels === null ? null : bodyFieldFrom(levels, "insets").value,
          edit.set as FieldValue<"body", "insets">,
        )
      )
        slots.push(insetsWrite(edit.set as FieldValue<"body", "insets">))
    } else if (name === "anchor") {
      if (edit === "inherit") slots.push(anchorInherit)
      else if ((levels === null ? null : bodyFieldFrom(levels, "anchor").value) !== edit.set)
        slots.push(anchorWrite(edit.set as FieldValue<"body", "anchor">))
    } else if (name === "wrap") {
      if (edit === "inherit") slots.push(wrapInherit)
      else if ((levels === null ? null : bodyFieldFrom(levels, "wrap").value) !== edit.set)
        slots.push(wrapWrite(edit.set as FieldValue<"body", "wrap">))
    } else if (name === "autofit") {
      if (edit === "inherit") slots.push(autofitInherit)
      else if ((levels === null ? null : bodyFieldFrom(levels, "autofit").value) !== edit.set)
        slots.push(autofitWrite(edit.set as FieldValue<"body", "autofit">))
    } else if (name === "vertical") {
      if (edit === "inherit") slots.push(verticalInherit)
      else if ((levels === null ? null : bodyFieldFrom(levels, "vertical").value) !== edit.set)
        slots.push(verticalWrite(edit.set as FieldValue<"body", "vertical">))
    } else {
      if (edit === "inherit") slots.push(columnsInherit)
      else if ((levels === null ? null : bodyFieldFrom(levels, "columns").value) !== edit.set)
        slots.push(columnsWrite(edit.set as FieldValue<"body", "columns">))
    }
  }
  return slots.length === 0 ? parts : bodyEdited(parts, at, slots.length === 1 ? slots[0]! : inTurn(...slots))
}

export const bodyXml: TraitXml<"body"> = {
  slot: null,
  fields: {
    insets: field("insets", insetsWrite, insetsInherit),
    anchor: field("anchor", anchorWrite, anchorInherit),
    wrap: field("wrap", wrapWrite, wrapInherit),
    autofit: field("autofit", autofitWrite, autofitInherit),
    vertical: field("vertical", verticalWrite, verticalInherit),
    columns: field("columns", columnsWrite, columnsInherit),
  },
}
