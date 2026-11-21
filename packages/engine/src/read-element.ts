import { foldDesign, pointBox, printDesign, shownDesign, templateFontDesign } from "@airdesign/catalog"
import {
  addedGeometry,
  currentBox,
  currentValue,
  drawnDesign,
  followedPlace,
  groupedNow,
  history,
  landedPatch,
  netPatch,
  openingElement,
  shapeOf,
  slideKind,
  version,
  withCurrentKeys,
  type Box,
  type Design,
  type ElementId,
  type IndexElement,
  type NodeRegister,
  type Palette,
  type Routed,
  type Register,
} from "@airdesign/document"
import type { ReadElement } from "./read-deck.js"

function closedTo(body: NodeRegister, runId: string | null): boolean {
  if (body.phase !== "running" || body.runId === null) return false
  if (body.guarded) return true
  return body.runId !== runId
}

export function foldedElement(register: Register, node: ElementId): IndexElement | undefined {
  const opening = openingElement(register, node)
  if (opening === undefined) return undefined
  const drawn = opening.design === undefined ? addedGeometry(register, node) : null
  const design = drawn === null ? {} : { design: drawnDesign(drawn, opening.box ?? undefined, opening.value === "") }
  return { ...opening, grouped: groupedNow(register, node), ...design }
}

function shownValue(value: string | null): string | null {
  return value === null ? null : withCurrentKeys(value)
}

function turnOf({ place }: Routed) {
  return { box: { rot: { set: place.rot }, flipH: { set: place.flipH }, flipV: { set: place.flipV } } }
}

function boxOf(body: NodeRegister | undefined, indexed: IndexElement | undefined, followed: Routed | null) {
  return followed?.place.box ?? (body === undefined ? null : currentBox(body)) ?? indexed?.box ?? null
}

function designOf(
  body: NodeRegister | undefined,
  indexed: IndexElement | undefined,
  followed: Routed | null,
  box: Box | null,
): Design | undefined {
  const edited = body !== undefined && history(body).length > 0
  const typed = edited ? shownDesign(indexed?.design ?? {}, currentValue(body)) : indexed?.design
  const opening = indexed?.opening === undefined ? [] : [{ v: 1, patch: indexed.opening }]
  const rows = body === undefined ? [] : [{ v: 1, patch: landedPatch(body, "text") }]
  const turned = followed === null ? [] : [{ v: 1, patch: turnOf(followed) }]
  const folded = foldDesign(typed, netPatch([...opening, ...rows, ...turned]), box ?? undefined)
  return followed === null ? folded : { ...folded, geometry: [followed.preset] as const }
}

export function layerDesign(register: Register, node: ElementId): Design | undefined {
  const indexed = foldedElement(register, node)
  const body = register.elements[node]
  const followed = followedPlace(register, node)
  return designOf(body, indexed, followed, boxOf(body, indexed, followed))
}

function elementOf(
  node: ElementId,
  body: NodeRegister | undefined,
  runId: string | null,
  fonts: NonNullable<Palette["fonts"]>,
  indexed: IndexElement | undefined,
  followed: Routed | null,
): ReadElement {
  const box = boxOf(body, indexed, followed)
  const own = slideKind(node) === "slide"
  const held = {
    node,
    slide: shapeOf(node).slide,
    value: shownValue(own || body === undefined ? (indexed?.value ?? null) : currentValue(body)),
    version: body === undefined ? 0 : version(body),
    ...(indexed === undefined
      ? own
        ? { kind: "slide" as const }
        : {}
      : { kind: indexed.kind, grouped: indexed.grouped }),
  }
  const withBox = box === null && indexed === undefined ? held : { ...held, box: box === null ? null : pointBox(box) }
  const design = designOf(body, indexed, followed, box)
  const line = design === undefined ? "" : printDesign(templateFontDesign(design, fonts))
  const linkEdit = body === undefined ? undefined : landedPatch(body, "text").link?.target
  const link = typeof linkEdit === "object" ? linkEdit.set : indexed?.link
  const designed = {
    ...(link === undefined ? {} : { link }),
    ...withBox,
    ...(indexed?.role === undefined ? {} : { role: indexed.role }),
    ...(line === "" ? {} : { design: line }),
  }
  if (body === undefined || !closedTo(body, runId)) return designed
  return { ...designed, closed: true }
}

export function readElement(
  register: Register,
  node: ElementId,
  runId: string | null,
  fonts: NonNullable<Palette["fonts"]>,
): ReadElement {
  const indexed = foldedElement(register, node)
  return elementOf(node, register.elements[node], runId, fonts, indexed, followedPlace(register, node))
}
