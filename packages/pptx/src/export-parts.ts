import {
  elementGone,
  floorNodes,
  landedPatch,
  netPatch,
  newSlideElement,
  rowOf,
  shapeOf,
  shownPatch,
  slideGone,
  takes,
  type ElementId,
  type ElementPatch,
  type FieldEdit,
  type FieldKey,
  type IndexElement,
  type NodeRegister,
  type Register,
  type TraitName,
} from "@airdesign/document"
import { slidePart } from "./package-address.js"
import { readShapes, shapeKind, type ReadShape } from "./read-shapes.js"
import { writeTrait } from "./trait-xml.js"
import type { Parts } from "./xml-codec.js"

type Fields = Record<string, FieldEdit<unknown>>

function entries(patch: ElementPatch): readonly (readonly [TraitName, Readonly<Fields>])[] {
  return Object.entries(patch) as [TraitName, Fields][]
}

function writtenNotes(
  parts: Parts,
  node: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
): Parts {
  const value = opening?.value ?? null
  const patch =
    body !== undefined ? shownPatch(body, "notes").notes : value === null ? undefined : { value: { set: value } }
  if (patch === undefined) return parts
  const slide = shapeOf(node).slide
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("notes-body")
  return writeTrait(parts, { slide, part, shape: "notes" }, "notes", patch)
}

function openingPatch(opening: IndexElement | undefined): ElementPatch {
  if (opening === undefined) return {}
  const text = rowOf({ value: opening.value ?? "" }, "text")
  return opening.box === null || opening.grouped
    ? text.patch
    : netPatch([text, rowOf({ property: "box", value: opening.box }, "text")])
}

function writtenElement(
  parts: Parts,
  shapes: readonly ReadShape[],
  node: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
): Parts {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === node)
  const shape = named.length === 1 ? named[0] : undefined
  const rows = body === undefined ? {} : landedPatch(body, shape?.contentKind === "table" ? "table" : "text")
  const facts = shape && { kind: shapeKind(shape), text: shape.text.length > 0, grouped: shape.grouped === true }
  const taken = facts === undefined ? null : takes({ ...facts, animated: false })
  const opened = shape === undefined || shape.locked ? {} : openingPatch(opening)
  const written = new Map<TraitName, Fields>()
  for (const [trait, fields] of entries(opened)) {
    if (trait !== "box" || shape?.grouped !== true) written.set(trait, { ...fields })
  }
  for (const [trait, fields] of entries(rows)) {
    const kept = written.get(trait) ?? {}
    for (const [field, edit] of Object.entries(fields)) {
      delete kept[field]
      if (taken !== null && !taken.includes(`${trait}.${field}` as FieldKey)) continue
      if (shape === undefined || (shape.locked && shape.contentKind !== "table")) throw new Error(`${trait}-shape`)
      kept[field] = edit
    }
    written.set(trait, kept)
  }
  if (shape === undefined) return parts
  const at = { slide: shape.slide, part: shape.part, shape: shape.shape }
  let next = parts
  for (const [trait, fields] of written) next = writeTrait(next, at, trait, fields)
  return next
}

export function exportParts(parts: Parts, register: Register): Parts {
  const shapes = readShapes(parts)
  let next = parts
  for (const node of new Set([...register.nodes, ...floorNodes(register)])) {
    if (node.includes(".") && (slideGone(register, shapeOf(node).slide) || elementGone(register, node))) continue
    const body = register.nodes.includes(node) ? register.elements[node] : undefined
    const opening = newSlideElement(register, node)
    next = node.endsWith(".notes")
      ? writtenNotes(next, node, body, opening)
      : writtenElement(next, shapes, node, body, opening)
  }
  return next
}
