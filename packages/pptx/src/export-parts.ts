import {
  elementGone,
  floorNodes,
  kindTraits,
  landedPatch,
  layoutMarker,
  layoutNodes,
  netPatch,
  readLayout,
  rebasedGroups,
  clonedLayer,
  newSlideElement,
  rowOf,
  shapeOf,
  shownPatch,
  slideGone,
  slideKind,
  takes,
  templateStylesNode,
  templateStyleIndex,
  type ElementId,
  type ElementPatch,
  type FieldEdit,
  type FieldKey,
  type IndexElement,
  type NodeRegister,
  type Register,
  type TraitName,
  type SlideNumbers,
} from "@airdesign/document"
import { routedParts } from "./connector-route.js"
import { textLayerName, textNamedLayers } from "./layer-names.js"
import { childSpace, fitGroup, placeFrame, shapePlace } from "./group-write.js"
import { markFrame } from "./frame-tag.js"
import { withFiledFrames } from "./filed-frames.js"
import type { ShapeBox } from "./shape-write.js"
import { dropUnusedTemplates } from "./template-drop.js"
import { slidePart } from "./package-address.js"
import { partBytes } from "./part-markup.js"
import { readShapes, shapeKind, type ReadShape } from "./read-shapes.js"
import { frameSize, scaledGrid } from "./table-size.js"
import { writeTrait } from "./trait-xml.js"
import { templateStyles } from "./template-style.js"
import { slideNumbering } from "./slide-numbering.js"
import { slideThemes } from "./trait-xml-theme.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Fields = Record<string, FieldEdit<unknown>>

function entries(patch: ElementPatch): readonly (readonly [TraitName, Readonly<Fields>])[] {
  return Object.entries(patch) as [TraitName, Fields][]
}

function boxLast(body: NodeRegister | undefined): boolean {
  const patches = (body?.landed ?? []).filter((row) => row.visible).map((row) => rowOf(row, "table").patch)
  const box = patches.findLastIndex((patch) => patch.box !== undefined)
  return box > patches.findLastIndex((patch) => patch.table !== undefined)
}

function sizedTable(parts: Parts, at: ElementAt, fields: Fields): Parts {
  const before = frameSize(partBytes(parts, at.part), at.shape)
  const next = writeTrait(parts, at, "box", fields)
  const written = partBytes(next, at.part)
  const fitted = scaledGrid(written, at.shape, before)
  if (fitted === written) return next
  const sized = new Map(next)
  sized.set(at.part, fitted)
  return sized
}

function writtenTable(parts: Parts, at: ElementAt, written: ReadonlyMap<TraitName, Fields>, last: boolean): Parts {
  const box = written.get("box")
  const sized = (from: Parts) => (box === undefined ? from : sizedTable(from, at, box))
  let next = last ? parts : sized(parts)
  for (const [trait, fields] of written) if (trait !== "box") next = writeTrait(next, at, trait, fields)
  return last ? sized(next) : next
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

function openedValue(opening: IndexElement): ElementPatch | null {
  const traits: readonly TraitName[] = kindTraits[opening.kind]
  const holder = traits.includes("text") ? "text" : traits.includes("table") ? "table" : null
  return holder === null ? null : rowOf({ value: opening.value ?? "" }, holder).patch
}

function openingPatch(opening: IndexElement | undefined): ElementPatch {
  if (opening === undefined) return {}
  const value = openedValue(opening)
  const text = value === null ? [] : [{ v: 1, patch: value }]
  const box = opening.box === null || opening.grouped ? [] : [rowOf({ property: "box", value: opening.box }, "text")]
  const floor = opening.opening === undefined ? [] : [{ v: 1, patch: opening.opening }]
  return netPatch([...text, ...box, ...floor])
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
  const patch = body === undefined ? {} : landedPatch(body, "text")
  const slide = shapeOf(node).slide
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("fill-slide")
  let next = parts
  for (const trait of ["templateStyle", "fills", "show", "transition", "guides"] as const) {
    const fields = heldFields(opening?.opening?.[trait] ?? {}, patch[trait] ?? {})
    if (Object.keys(fields).length > 0) next = writeTrait(next, { slide, part, shape: "slide" }, trait, fields)
  }
  return next
}

function writtenTheme(parts: Parts, body: NodeRegister | undefined): Parts {
  const fields = body === undefined ? undefined : landedPatch(body, "text").templateStyle
  if (fields === undefined) return parts
  let next = parts
  for (const part of slideThemes(parts))
    next = writeTrait(next, { slide: "", part, shape: "theme" }, "templateStyle", fields)
  return next
}

function writtenElement(
  parts: Parts,
  shapes: readonly ReadShape[],
  node: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
  media: ElementAt["media"],
  numbering: ReadonlyMap<string, SlideNumbers>,
  textNamed: boolean,
): Parts {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === node)
  const shape = named.length === 1 ? named[0] : undefined
  const rows = body === undefined ? {} : landedPatch(body, shape?.contentKind === "table" ? "table" : "text")
  const facts = shape && {
    kind: shapeKind(shape),
    text: shape.text.length > 0 || shape.contentKind === "chart",
    grouped: shape.grouped === true,
  }
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
  if (textNamed) namedByText(written)
  const numbers = numbering.get(shape.slide)
  const at = {
    slide: shape.slide,
    part: shape.part,
    shape: shape.shape,
    ...(media === undefined ? {} : { media }),
    ...(numbers === undefined ? {} : { numbers }),
  }
  if (shape.contentKind === "table") return writtenTable(parts, at, written, boxLast(body))
  let next = parts
  for (const [trait, fields] of written) next = writeTrait(next, at, trait, fields)
  return next
}

function namedByText(written: Map<TraitName, Fields>): void {
  const identity = written.get("identity") ?? {}
  const value = written.get("text")?.value
  if (identity.name !== undefined || typeof value !== "object" || typeof value.set !== "string") return
  written.set("identity", { ...identity, name: { set: textLayerName(value.set) } })
}

function boxFields(box: { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }) {
  return { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } }
}

function sameBox(left: { readonly box: ShapeBox } | null, right: ShapeBox): boolean {
  if (left === null) return false
  const { x, y, cx, cy } = left.box
  return x === right.x && y === right.y && cx === right.cx && cy === right.cy
}

function framePlaced(bytes: Uint8Array, shape: string, box: ShapeBox): boolean {
  return sameBox(shapePlace(bytes, shape), box) && sameBox(childSpace(bytes, shape), box)
}

function laidOutFrame(parts: Parts, register: Register, node: ElementId): Parts {
  const view = readLayout(register, node)
  const slide = shapeOf(node).slide
  const part = slidePart(parts, slide)
  if (view === null || part === null || slideGone(register, slide)) return parts
  let next = parts
  const shapes = [view.backdrop, ...view.children.map((child) => child.node)].map((each) => shapeOf(each).shape)
  const boxes = [view.box, ...view.children.map((child) => child.box)]
  let moved = !framePlaced(partBytes(next, part), shapeOf(node).shape, view.box)
  if (moved) next = new Map([...next, [part, placeFrame(partBytes(next, part), shapeOf(node).shape, view.box)]])
  for (const [at, shape] of shapes.entries()) {
    const box = boxes[at]
    if (box === undefined || sameBox(shapePlace(partBytes(next, part), shape), box)) continue
    moved = true
    next = writeTrait(next, { slide, part, shape }, "box", boxFields(box))
  }
  const made = register.order.some((command) => command.slide === "element-group" && command.element.node === node)
  if (!moved && !made && !register.nodes.includes(node)) return next
  return markFrame(next, part, shapeOf(node).shape, layoutMarker(view))
}

function followedGroups(parts: Parts, register: Register): Parts {
  let next = parts
  for (const { node, frame } of rebasedGroups(register)) {
    const slide = shapeOf(node).slide
    const part = slidePart(next, slide)
    if (part === null || slideGone(register, slide)) continue
    next = new Map([...next, [part, fitGroup(partBytes(next, part), shapeOf(node).shape, frame)]])
  }
  return next
}

function laidOutFrames(parts: Parts, register: Register): Parts {
  let next = parts
  for (const node of layoutNodes(register)) next = laidOutFrame(next, register, node)
  return next
}

const noneSkipped: ReadonlySet<ElementId> = new Set()

export function exportParts(
  parts: Parts,
  register: Register,
  media?: ElementAt["media"],
  skipped: ReadonlySet<ElementId> = noneSkipped,
): Parts {
  const shapes = readShapes(parts)
  const numbers = slideNumbering(parts)
  const textNamed = textNamedLayers(register)
  let next = writtenTheme(
    parts,
    register.nodes.includes(templateStylesNode) && !skipped.has(templateStylesNode)
      ? register.elements[templateStylesNode]
      : undefined,
  )
  const styles = register.index?.templateStyles ?? templateStyles(parts)
  for (const node of new Set([...register.nodes, ...floorNodes(register)])) {
    if (node === templateStylesNode || skipped.has(node)) continue
    if (node.includes(".") && (slideGone(register, shapeOf(node).slide) || elementGone(register, node))) continue
    const body = register.nodes.includes(node) ? register.elements[node] : undefined
    const opening = newSlideElement(register, node) ?? clonedLayer(register, node)
    const kind = slideKind(node)
    const index = templateStyleIndex(node)
    if (index !== null) {
      const id = styles[index]?.id
      const fields = body === undefined ? undefined : landedPatch(body, "text").templateStyle
      const removed = typeof fields?.removed === "object" && fields.removed.set === true
      if (id !== undefined && fields !== undefined && !removed && next.has(id))
        next = writeTrait(next, { slide: "", part: id, shape: "theme" }, "templateStyle", fields)
      continue
    }
    next =
      kind === "notes"
        ? writtenNotes(next, node, body, opening)
        : kind === "slide"
          ? writtenSlide(next, node, body, opening)
          : writtenElement(next, shapes, node, body, opening, media, numbers, textNamed.has(node))
  }
  const followed = followedGroups(next, register)
  return dropUnusedTemplates(routedParts(parts, laidOutFrames(followed, withFiledFrames(parts, register))), register)
}
