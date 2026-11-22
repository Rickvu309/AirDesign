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
import { slideAddresses, slidePart } from "./package-address.js"
import { partBytes } from "./part-markup.js"
import { readShapeFacts, shapeKind, type ShapeFact } from "./read-shapes.js"
import { SlideEditor } from "./slide-editor.js"
import { writeTrait } from "./trait-xml.js"
import { templateStyles } from "./template-style.js"
import { slideNumbering } from "./slide-numbering.js"
import { slideThemes } from "./trait-xml-theme.js"
import type { ElementAt, Parts } from "./xml-codec.js"

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

function openedValue(opening: IndexElement): ElementPatch | null {
  const traits: readonly TraitName[] = kindTraits[opening.kind]
  return traits.includes("text") ? rowOf({ value: opening.value ?? "" }, "text").patch : null
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

const takenSets = new WeakMap<readonly FieldKey[], ReadonlySet<FieldKey>>()

function takenSet(keys: readonly FieldKey[]): ReadonlySet<FieldKey> {
  let set = takenSets.get(keys)
  if (set === undefined) {
    set = new Set(keys)
    takenSets.set(keys, set)
  }
  return set
}

function fillsTouchRelationships(fields: Fields | undefined): boolean {
  if (fields === undefined) return false
  if (fields.source !== undefined) return true
  for (const key of ["p0", "p1", "p2", "p3"] as const) {
    const edit = fields[key]
    if (
      typeof edit === "object" &&
      edit !== null &&
      typeof edit.set === "object" &&
      edit.set !== null &&
      "image" in edit.set
    ) {
      return true
    }
  }
  return false
}

function writtenElement(
  editor: SlideEditor,
  shape: ShapeFact | undefined,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
  media: ElementAt["media"],
  numbering: ReadonlyMap<string, SlideNumbers>,
  textNamed: boolean,
): void {
  const rows = body === undefined ? {} : landedPatch(body, "text")
  const facts = shape && {
    kind: shapeKind(shape),
    text: shape.hasText || shape.contentKind === "chart",
    grouped: shape.grouped === true,
  }
  const taken = facts === undefined ? null : takenSet(takes({ ...facts, animated: false }))
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
      if (taken !== null && !taken.has(`${trait}.${field}` as FieldKey)) continue
      if (shape === undefined || shape.locked) throw new Error(`${trait}-shape`)
      kept[field] = edit
    }
    written.set(trait, kept)
  }
  if (shape === undefined) return
  if (textNamed) namedByText(written)
  if (written.size === 0) return
  const numbers = numbering.get(shape.slide)
  const at = {
    slide: shape.slide,
    part: shape.part,
    shape: shape.shape,
    ...(media === undefined ? {} : { media }),
    ...(numbers === undefined ? {} : { numbers }),
  }
  const deferText =
    shape.kind === "p:sp" &&
    written.size > 1 &&
    written.has("text") &&
    !written.has("link") &&
    !fillsTouchRelationships(written.get("fills"))
  editor.editShape(
    shape.part,
    shape.shape,
    (scoped) => {
      let next = scoped
      for (const [trait, fields] of written) {
        if (deferText && trait === "text") continue
        next = writeTrait(next, at, trait, fields)
      }
      if (deferText) next = writeTrait(next, at, "text", written.get("text")!)
      return next
    },
    { touchesChildren: shape.kind === "p:grpSp" && written.has("box") },
  )
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

function laidOutFrame(
  editor: SlideEditor,
  register: Register,
  node: ElementId,
  slideParts: ReadonlyMap<string, string>,
  madeGroups: ReadonlySet<ElementId>,
  nodeSet: ReadonlySet<ElementId>,
): void {
  const view = readLayout(register, node)
  const slide = shapeOf(node).slide
  const part = slideParts.get(slide)
  if (view === null || part === undefined || slideGone(register, slide)) return
  const frameShape = shapeOf(node).shape
  const shapes = [view.backdrop, ...view.children.map((child) => child.node)].map((each) => shapeOf(each).shape)
  const boxes = [view.box, ...view.children.map((child) => child.box)]
  let moved = !editor.readShape(part, frameShape, (bytes) => framePlaced(bytes, frameShape, view.box))
  if (moved) {
    editor.editShape(part, frameShape, (scoped) => {
      const next = new Map(scoped)
      next.set(part, placeFrame(partBytes(scoped, part), frameShape, view.box))
      return next
    })
  }
  for (const [at, shape] of shapes.entries()) {
    const box = boxes[at]
    if (
      box === undefined ||
      sameBox(
        editor.readShape(part, shape, (bytes) => shapePlace(bytes, shape)),
        box,
      )
    )
      continue
    moved = true
    editor.editShape(part, shape, (scoped) => writeTrait(scoped, { slide, part, shape }, "box", boxFields(box)), {
      touchesChildren: true,
    })
  }
  if (!moved && !madeGroups.has(node) && !nodeSet.has(node)) return
  editor.editShape(part, frameShape, (scoped) => markFrame(scoped, part, frameShape, layoutMarker(view)))
}

function followedGroups(editor: SlideEditor, register: Register, slideParts: ReadonlyMap<string, string>): void {
  for (const { node, frame } of rebasedGroups(register)) {
    const slide = shapeOf(node).slide
    const part = slideParts.get(slide)
    if (part === undefined || slideGone(register, slide)) continue
    const shape = shapeOf(node).shape
    editor.editShape(part, shape, (scoped) => {
      const next = new Map(scoped)
      next.set(part, fitGroup(partBytes(scoped, part), shape, frame))
      return next
    })
  }
}

function laidOutFrames(
  editor: SlideEditor,
  register: Register,
  slideParts: ReadonlyMap<string, string>,
  nodeSet: ReadonlySet<ElementId>,
): void {
  const frames = layoutNodes(register)
  if (frames.length === 0) return
  const madeGroups = new Set<ElementId>()
  for (const command of register.order) {
    if (command.slide === "element-group") madeGroups.add(command.element.node)
  }
  for (const node of frames) laidOutFrame(editor, register, node, slideParts, madeGroups, nodeSet)
}

const noneSkipped: ReadonlySet<ElementId> = new Set()

export function exportParts(
  parts: Parts,
  register: Register,
  media?: ElementAt["media"],
  skipped: ReadonlySet<ElementId> = noneSkipped,
): Parts {
  const shapes = readShapeFacts(parts)
  const shapeByNode = new Map<string, ShapeFact | null>()
  for (const shape of shapes) {
    const key = `${shape.slide}.${shape.shape}`
    shapeByNode.set(key, shapeByNode.has(key) ? null : shape)
  }
  const slideParts = new Map(slideAddresses(parts).map((address) => [address.slide, address.part]))
  const numbers = slideNumbering(parts)
  const textNamed = textNamedLayers(register)
  const nodeSet = new Set(register.nodes)
  const themed = writtenTheme(
    parts,
    nodeSet.has(templateStylesNode) && !skipped.has(templateStylesNode)
      ? register.elements[templateStylesNode]
      : undefined,
  )
  const editor = new SlideEditor(themed)
  const styles = register.index?.templateStyles ?? templateStyles(parts)
  for (const node of new Set([...register.nodes, ...floorNodes(register)])) {
    if (node === templateStylesNode || skipped.has(node)) continue
    if (node.includes(".") && (slideGone(register, shapeOf(node).slide) || elementGone(register, node))) continue
    const body = nodeSet.has(node) ? register.elements[node] : undefined
    const opening = newSlideElement(register, node) ?? clonedLayer(register, node)
    const kind = slideKind(node)
    const index = templateStyleIndex(node)
    if (index !== null) {
      const id = styles[index]?.id
      const fields = body === undefined ? undefined : landedPatch(body, "text").templateStyle
      const removed = typeof fields?.removed === "object" && fields.removed.set === true
      if (id !== undefined && fields !== undefined && !removed) {
        editor.editAny((current) =>
          current.has(id)
            ? writeTrait(current, { slide: "", part: id, shape: "theme" }, "templateStyle", fields)
            : current,
        )
      }
      continue
    }
    if (kind === "notes") {
      editor.editAny((current) => writtenNotes(current, node, body, opening))
    } else if (kind === "slide") {
      const part = slideParts.get(shapeOf(node).slide)
      if (part === undefined) throw new Error("fill-slide")
      editor.editWhole(part, (current) => writtenSlide(current, node, body, opening))
    } else {
      writtenElement(editor, shapeByNode.get(node) ?? undefined, body, opening, media, numbers, textNamed.has(node))
    }
  }
  followedGroups(editor, register, slideParts)
  laidOutFrames(editor, withFiledFrames(parts, register), slideParts, nodeSet)
  return dropUnusedTemplates(routedParts(parts, editor.flush()), register)
}
