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
  slideKind,
  takes,
  upgradeBackgrounds,
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
  const box = opening.box === null || opening.grouped ? [] : [rowOf({ property: "box", value: opening.box }, "text")]
  const floor = opening.opening === undefined ? [] : [{ v: 1, patch: opening.opening }]
  return netPatch([text, ...box, ...floor])
}

function heldFields(opened: Readonly<Fields>, rows: Readonly<Fields>): Fields {
  const kept: Fields = { ...opened }
  for (const [field, edit] of Object.entries(rows)) {
    if (edit === "opening" && kept[field] !== undefined) continue
    kept[field] = edit
  }
  return kept
}

function writtenSlide(
  parts: Parts,
  node: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
): Parts {
  const opened: Readonly<Fields> = opening?.opening?.fill ?? {}
  const rows: Readonly<Fields> = (body === undefined ? undefined : landedPatch(body, "text").fill) ?? {}
  const fields = heldFields(opened, rows)
  if (Object.keys(fields).length === 0) return parts
  const slide = shapeOf(node).slide
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("fill-slide")
  return writeTrait(parts, { slide, part, shape: "slide" }, "fill", fields)
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
      if (edit === "opening" && kept[field] !== undefined) continue
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

export function exportParts(parts: Parts, stored: Register): Parts {
  const register = upgradeBackgrounds(stored)
  const shapes = readShapes(parts)
  let next = parts
  for (const node of new Set([...register.nodes, ...floorNodes(register)])) {
    if (node.includes(".") && (slideGone(register, shapeOf(node).slide) || elementGone(register, node))) continue
    const body = register.nodes.includes(node) ? register.elements[node] : undefined
    const opening = newSlideElement(register, node)
    const kind = slideKind(node)
    next =
      kind === "notes"
        ? writtenNotes(next, node, body, opening)
        : kind === "slide"
          ? writtenSlide(next, node, body, opening)
          : writtenElement(next, shapes, node, body, opening)
  }
  return next
}
