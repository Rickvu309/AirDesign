import type { Box } from "./box.js"
import { outlineOf, siteKinds, type Outline } from "./connector.js"
import { currentBox, currentValue, elementFacts, landedPatch, type Register } from "./decide.js"
import type { SlideSize } from "./deck-index.js"
import type { DesignKey, Role } from "./design.js"
import {
  shapeOf,
  slideKind,
  slideNode,
  themeNode,
  templateIndex,
  templateNode,
  type ElementId,
  type SlideId,
} from "./element-id.js"
import { groupParent } from "./element-group.js"
import { elementGone } from "./element-order.js"
import { opacityFields, takes, type ElementFacts } from "./element-takes.js"
import { format } from "./format.js"
import type { ElementPatch, FieldEdit, Row } from "./row.js"
import { siteCount } from "./preset-sites.js"
import { floorNodes, openingElement } from "./slide-floor.js"
import { presentSlides, slideGone } from "./slide-order.js"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"
import {
  inheritable,
  keptRefuses,
  traitNames,
  traits,
  type AlphaField,
  type FieldKey,
  type FieldName,
  type FieldValue,
  type HasAlpha,
  type InheritableField,
  type InputKinds,
  type InputName,
  type TraitName,
} from "./traits.js"
import type { Alpha, ValueOf } from "./value-kind.js"

export type Target =
  | { readonly node: ElementId }
  | { readonly nodes: readonly ElementId[] }
  | { readonly slide: SlideId }
  | { readonly role: Role; readonly slide: SlideId | "every" }

export type TraitInput<T extends TraitName> = {
  readonly [F in Exclude<FieldName<T>, AlphaField<T>>]?:
    | FieldValue<T, F>
    | (F extends InheritableField<T> ? null : never)
} & { readonly [I in InputName<T>]?: ValueOf<InputKinds<T>[I]> }

export type TraitInputs = { readonly [T in TraitName]?: TraitInput<T> }

export type ElementInputs = HasAlpha extends true ? { readonly opacity?: Alpha } : Record<never, never>

export type SetChange = { readonly target: Target } & ElementInputs & TraitInputs

export type AddChange =
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly text?: TraitInput<"text"> }
  | { readonly kind: "picture"; readonly slide: SlideId; readonly box?: Box; readonly icon: string }

export type ScopedElement = {
  readonly node: ElementId
  readonly facts: ElementFacts
  readonly kept: readonly DesignKey[]
  readonly value: string | null
  readonly box: Box | null
  readonly placed?: Box
  readonly outline?: Outline | null
  readonly parent?: ElementId | null
}

export type Scope = {
  readonly expand: (target: Target) => readonly ElementId[] | "indexing"
  readonly view: (node: ElementId) => ScopedElement | undefined
  readonly size: (slide: SlideId) => SlideSize | null
  readonly templates?: readonly string[]
}

export type PlanRefusal = "kind" | "group-box" | "kept" | "site" | "indexing" | "dead"

export type ChangeRefusal = {
  readonly node: ElementId | null
  readonly trait: TraitName | null
  readonly code: PlanRefusal
}

export type NodeRow = { readonly node: ElementId; readonly row: Row }

export type PlannedChange =
  | { readonly ok: true; readonly rows: readonly NodeRow[] }
  | { readonly ok: false; readonly refusals: readonly ChangeRefusal[] }

const rolesFrom = 2

type Loose = Readonly<Record<string, unknown>>

function inputOf(trait: TraitName, key: string): boolean {
  return Object.hasOwn(traits[trait].inputs, key)
}

export function writtenField(trait: TraitName, key: string): FieldKey {
  if (!inputOf(trait, key)) return `${trait}.${key}` as FieldKey
  return trait === "box" ? "box.x" : (`${trait}.value` as FieldKey)
}

function namedTraits(change: TraitInputs): readonly (readonly [TraitName, Loose])[] {
  return traitNames.flatMap((trait) => {
    const input: Loose | undefined = change[trait]
    return input === undefined || Object.keys(input).length === 0 ? [] : [[trait, input] as const]
  })
}

export function namedFields(change: TraitInputs): readonly FieldKey[] {
  const fields = namedTraits(change).flatMap(([trait, input]) =>
    Object.keys(input).map((key) => writtenField(trait, key)),
  )
  return [...new Set(fields)]
}

function refusalOf(view: ScopedElement, trait: TraitName, input: Loose): PlanRefusal | null {
  const taken = takes(view.facts)
  const unset = Object.entries(input).some(([key, value]) => value === null && !inheritable(trait, key))
  if (unset || Object.keys(input).some((key) => !taken.includes(writtenField(trait, key))))
    return view.facts.grouped && trait === "box" ? "group-box" : "kind"
  return Object.keys(input).some((key) => keptRefuses(view.kept, trait, key)) ? "kept" : null
}

function shownText(value: string): TextValue {
  return readTextValue(value) ?? (value === "" ? [] : [{ from: 0, runs: [{ from: 0, text: value }] }])
}

const runKeys = ["color", "size", "font", "bold", "italic", "underline", "strike", "letterSpacing"] as const
const paragraphKeys = ["align", "list", "lineSpacing", "spaceBefore", "spaceAfter"] as const

function picked(input: Loose, keys: readonly string[]): Loose {
  return Object.fromEntries(keys.flatMap((key) => (Object.hasOwn(input, key) ? [[key, input[key]]] : [])))
}

function restyled(value: string, input: Loose): string {
  const run = picked(input, runKeys)
  const paragraph = picked(input, paragraphKeys)
  const text = shownText(value).map((each) => ({
    ...each,
    ...paragraph,
    runs: each.runs.map((item) => ({ ...item, ...run })),
  })) as TextValue
  return text.length === 0 ? "" : writeTextValue(text)
}

function wholeBox(box: Box | null): Loose {
  return box === null ? {} : { x: box.x, y: box.y, w: box.cx, h: box.cy }
}

type Spot = { readonly x: number; readonly y: number }
type Frame = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Placed = ReadonlyMap<ElementId, Spot>

function boxed(box: Box, input: Loose): Box {
  const x = typeof input.x === "number" ? input.x : box.x
  const y = typeof input.y === "number" ? input.y : box.y
  const cx = typeof input.w === "number" ? input.w : box.cx
  const cy = typeof input.h === "number" ? input.h : box.cy
  return { x, y, cx, cy }
}

function boundsOf(boxes: readonly Box[]): Frame {
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.cx))
  const bottom = Math.max(...boxes.map((box) => box.y + box.cy))
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function alignedBox(box: Box, frame: Frame, align: string): Box {
  const across = (from: number, room: number, size: number, at: number) => Math.round(from + ((room - size) * at) / 2)
  if (align === "left") return { ...box, x: frame.x }
  if (align === "center") return { ...box, x: across(frame.x, frame.w, box.cx, 1) }
  if (align === "right") return { ...box, x: across(frame.x, frame.w, box.cx, 2) }
  if (align === "top") return { ...box, y: frame.y }
  if (align === "middle") return { ...box, y: across(frame.y, frame.h, box.cy, 1) }
  return { ...box, y: across(frame.y, frame.h, box.cy, 2) }
}

function distributedBoxes(boxes: readonly Box[], frame: Frame, across: boolean): readonly Box[] {
  const start = (box: Box) => (across ? box.x : box.y)
  const length = (box: Box) => (across ? box.cx : box.cy)
  const order = boxes.map((box, at) => ({ box, at })).sort((left, right) => start(left.box) - start(right.box))
  const room = across ? frame.w : frame.h
  const used = boxes.reduce((sum, box) => sum + length(box), 0)
  const lone = boxes.length === 1
  const gap = (room - used) / (lone ? 2 : boxes.length - 1)
  const next: Box[] = [...boxes]
  let cursor = (across ? frame.x : frame.y) + (lone ? gap : 0)
  for (const { box, at } of order) {
    const spot = Math.round(cursor)
    next[at] = across ? { ...box, x: spot } : { ...box, y: spot }
    cursor += length(box) + gap
  }
  return next
}

function slideFrame(size: SlideSize): Frame {
  return { x: 0, y: 0, w: size.width, h: size.height }
}

function placements(input: Loose | undefined, views: readonly ScopedElement[], scope: Scope): Placed {
  const placed = new Map<ElementId, Spot>()
  const align = typeof input?.align === "string" ? input.align : undefined
  const distribute = typeof input?.distribute === "string" ? input.distribute : undefined
  if (input === undefined || (align === undefined && distribute === undefined)) return placed
  const slides = new Map<string, ScopedElement[]>()
  for (const view of views) {
    if ((view.box ?? view.placed) === undefined) continue
    const slide = shapeOf(view.node).slide
    slides.set(slide, [...(slides.get(slide) ?? []), view])
  }
  for (const [slide, group] of slides) {
    const size = scope.size(slide as SlideId)
    let boxes: readonly Box[] = group.map((view) => boxed((view.box ?? view.placed) as Box, input))
    const frame = boxes.length > 1 ? boundsOf(boxes) : size === null ? null : slideFrame(size)
    if (frame === null) continue
    if (align !== undefined) boxes = boxes.map((box) => alignedBox(box, frame, align))
    if (distribute !== undefined) boxes = distributedBoxes(boxes, frame, distribute === "horizontal")
    group.forEach((view, at) => {
      const box = boxes[at]
      if (box !== undefined) placed.set(view.node, { x: box.x, y: box.y })
    })
  }
  return placed
}

function traitPatch(
  trait: TraitName,
  input: Loose,
  view: ScopedElement,
  spot: Spot | undefined,
): Readonly<Record<string, FieldEdit<unknown>>> {
  const box = view.box ?? (spot === undefined ? null : (view.placed ?? null))
  const fields = trait === "box" ? { ...wholeBox(box), ...input, ...spot } : input
  const edits: Record<string, FieldEdit<unknown>> = {}
  for (const [key, value] of Object.entries(fields))
    if (!inputOf(trait, key)) edits[key] = value === null ? "inherit" : { set: value }
  if (trait !== "text" || !Object.keys(input).some((key) => inputOf(trait, key))) return edits
  const base = typeof input.value === "string" ? input.value : (view.value ?? "")
  return { ...edits, value: { set: restyled(base, input) } }
}

function moves(input: Loose): boolean {
  return Object.keys(input).some((key) => inputOf("box", key))
}

function fieldOf(key: FieldKey): readonly [TraitName, string] {
  const [trait, field] = key.split(".") as [TraitName, string]
  return [trait, field]
}

function opacityRefusals(view: ScopedElement): readonly ChangeRefusal[] {
  const fields = opacityFields(view.facts)
  if (fields.length === 0) return [{ node: view.node, trait: null, code: "kind" }]
  const kept = fields.map(fieldOf).find(([trait, field]) => keptRefuses(view.kept, trait, field))
  return kept === undefined ? [] : [{ node: view.node, trait: kept[0], code: "kept" }]
}

function siteFits(view: ScopedElement, end: unknown, scope: Scope): boolean {
  if (typeof end !== "object" || end === null || !("shape" in end)) return true
  const { node, site } = (end as { readonly shape: { readonly node: ElementId; readonly site: number } }).shape
  const target = node === view.node || shapeOf(node).slide !== shapeOf(view.node).slide ? undefined : scope.view(node)
  const outline = target?.outline
  if (target === undefined || !siteKinds.includes(target.facts.kind) || outline === undefined || outline === null)
    return false
  return site < siteCount(outline.preset) && (target.parent ?? null) === (view.parent ?? null)
}

function siteRefusals(change: SetChange, view: ScopedElement, scope: Scope): readonly ChangeRefusal[] {
  const input: Loose | undefined = change.connection
  if (input === undefined || [input.start, input.end].every((end) => siteFits(view, end, scope))) return []
  return [{ node: view.node, trait: "connection", code: "site" }]
}

function planNode(
  change: SetChange,
  view: ScopedElement,
  spot: Spot | undefined,
  scope: Scope,
): NodeRow | readonly ChangeRefusal[] {
  const named = namedTraits(change)
  if (change.template?.id !== undefined && !scope.templates?.includes(change.template.id))
    return [{ node: view.node, trait: "template", code: "kind" }]
  const refusals: ChangeRefusal[] = named.flatMap(([trait, input]) => {
    const unplaced = trait === "box" && moves(input) && spot === undefined && refusalOf(view, trait, input) === null
    const code = unplaced ? "kind" : refusalOf(view, trait, input)
    return code === null ? [] : [{ node: view.node, trait, code }]
  })
  if (refusals.length === 0) refusals.push(...siteRefusals(change, view, scope))
  const link = change.link?.target
  if (link?.kind === "slide" && scope.expand({ slide: link.slide }).length === 0)
    refusals.push({ node: view.node, trait: "link", code: "dead" })
  const runLinks =
    readTextValue(change.text?.value ?? "")?.flatMap((paragraph) =>
      paragraph.runs.flatMap((run) => (run.link?.kind === "slide" ? [run.link.slide] : [])),
    ) ?? []
  const priorLinks =
    readTextValue(view.value ?? "")?.flatMap((paragraph) =>
      paragraph.runs.flatMap((run) => (run.link?.kind === "slide" ? [run.link.slide] : [])),
    ) ?? []
  if (runLinks.some((slide) => !priorLinks.includes(slide) && scope.expand({ slide }).length === 0))
    refusals.push({ node: view.node, trait: "text", code: "dead" })
  if (change.opacity !== undefined) refusals.push(...opacityRefusals(view))
  if (refusals.length > 0) return refusals
  const patch: Record<string, Readonly<Record<string, FieldEdit<unknown>>>> = Object.fromEntries(
    named.map(([trait, input]) => [trait, traitPatch(trait, input, view, spot)]),
  )
  const opacity = change.opacity
  if (opacity !== undefined)
    for (const [trait, field] of opacityFields(view.facts).map(fieldOf))
      patch[trait] = { ...patch[trait], [field]: { set: opacity } }
  return { node: view.node, row: { v: format, patch: patch as ElementPatch } }
}

export function planChange(change: SetChange, scope: Scope): PlannedChange {
  const nodes = scope.expand(change.target)
  if (nodes === "indexing" || nodes.length === 0)
    return { ok: false, refusals: [{ node: null, trait: null, code: nodes === "indexing" ? "indexing" : "dead" }] }
  const rows: NodeRow[] = []
  const refusals: ChangeRefusal[] = []
  const views = nodes.flatMap((node) => scope.view(node) ?? [])
  const placed = placements(change.box as Loose | undefined, views, scope)
  for (const node of nodes) {
    const view = scope.view(node)
    const planned =
      view === undefined
        ? [{ node, trait: null, code: "dead" as const }]
        : planNode(change, view, placed.get(node), scope)
    if ("row" in planned) rows.push(planned)
    else refusals.push(...planned)
  }
  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, rows }
}

function indexReady(register: Register): boolean {
  const index = register.index
  return index !== undefined && index.elements.length === index.total
}

function slideOrder(register: Register): readonly string[] {
  if (register.order.length > 0) return presentSlides(register).map((spot) => spot.id)
  const slides = [...(register.index?.slides ?? [])].sort((left, right) => left.position - right.position)
  return slides.map((slide) => slide.id)
}

function present(register: Register, node: ElementId): boolean {
  return node.includes(".") && !slideGone(register, shapeOf(node).slide) && !elementGone(register, node)
}

function expandRole(register: Register, role: Role, slide: SlideId | "every"): readonly ElementId[] | "indexing" {
  if (!indexReady(register) || (register.index?.format ?? 1) < rolesFrom) return "indexing"
  const slides = slideOrder(register).filter((id) => slide === "every" || id === slide)
  const opening = [
    ...(register.index?.elements ?? []),
    ...floorNodes(register).flatMap((node) => openingElement(register, node) ?? []),
  ]
  return slides.flatMap((id) =>
    opening.flatMap((element) =>
      element.role === role && shapeOf(element.node).slide === id && present(register, element.node)
        ? [element.node]
        : [],
    ),
  )
}

function slideOwned(register: Register, node: ElementId): boolean {
  if (node === themeNode) return true
  const index = templateIndex(node)
  if (index !== null) return register.index?.templates?.[index] !== undefined
  return slideKind(node) !== null && slideOrder(register).includes(shapeOf(node).slide)
}

function expanded(register: Register, target: Target): readonly ElementId[] | "indexing" {
  if ("role" in target) return expandRole(register, target.role, target.slide)
  if ("nodes" in target) return expandedNodes(register, target.nodes)
  if (!("node" in target)) {
    const node = slideNode(target.slide, "slide")
    return slideOwned(register, node) && present(register, node) ? [node] : []
  }
  const templates = register.index?.templates ?? []
  if (target.node === themeNode && templates.length > 0) return templates.map((_, index) => templateNode(index))
  return expandedNode(register, target.node)
}

function expandedNode(register: Register, node: ElementId): readonly ElementId[] | "indexing" {
  const known = indexReady(register) || openingElement(register, node) !== undefined
  return known || slideOwned(register, node) ? [node] : "indexing"
}

function expandedNodes(register: Register, nodes: readonly ElementId[]): readonly ElementId[] | "indexing" {
  const unique = [...new Set(nodes)]
  return unique.some((node) => expandedNode(register, node) === "indexing") ? "indexing" : unique
}

function sizeOf(register: Register, slide: SlideId): SlideSize | null {
  const slides = register.index?.slides ?? []
  return slides.find((each) => each.id === slide)?.size ?? slides.find((each) => each.size !== undefined)?.size ?? null
}

type Shaped = { readonly preset: string; readonly adjust: Readonly<Record<string, number>> }

function outlineNow(
  rows: Readonly<Record<string, FieldEdit<unknown>>> | undefined,
  opening: ReturnType<typeof openingElement>,
): Outline | null {
  const edit = rows?.shape
  if (typeof edit === "object" && edit !== null && "set" in edit) {
    const shaped = edit.set as Shaped
    return outlineOf(shaped.preset, shaped.adjust)
  }
  if (opening?.kept?.includes("geometry") === true) return null
  const named = opening?.design?.geometry?.[0]
  return outlineOf(typeof named === "string" ? named : null, {})
}

export function registerScope(register: Register): Scope {
  return {
    expand: (target) => expanded(register, target),
    templates: register.index?.templates?.map((style) => style.id) ?? [],
    size: (slide) => sizeOf(register, slide),
    view: (node) => {
      const opening = openingElement(register, node)
      if ((opening === undefined && !slideOwned(register, node)) || !present(register, node)) return undefined
      const facts = elementFacts(register, node)
      if (facts === undefined) return undefined
      const body = register.nodes.includes(node) ? register.elements[node] : undefined
      return {
        node,
        facts,
        kept: opening?.kept ?? [],
        value: body === undefined ? (opening?.value ?? null) : currentValue(body),
        box: (body === undefined ? null : currentBox(body)) ?? opening?.box ?? null,
        ...(opening?.placed === undefined ? {} : { placed: opening.placed }),
        outline: outlineNow(body === undefined ? undefined : landedPatch(body, "text").geometry, opening),
        parent: groupParent(register, node) ?? null,
      }
    },
  }
}
