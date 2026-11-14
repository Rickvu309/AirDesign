import type { Box } from "./box.js"
import { currentBox, currentValue, elementFacts, type Register } from "./decide.js"
import type { DesignKey, Role } from "./design.js"
import { shapeOf, slideKind, slideNode, type ElementId, type SlideId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import { takes, type ElementFacts } from "./element-takes.js"
import { format } from "./format.js"
import type { ElementPatch, FieldEdit, Row } from "./row.js"
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
  type InheritableField,
  type InputKinds,
  type InputName,
  type TraitName,
} from "./traits.js"
import type { ValueOf } from "./value-kind.js"

export type Target =
  | { readonly node: ElementId }
  | { readonly slide: SlideId }
  | { readonly role: Role; readonly slide: SlideId | "every" }

export type TraitInput<T extends TraitName> = {
  readonly [F in Exclude<FieldName<T>, AlphaField<T>>]?:
    | FieldValue<T, F>
    | (F extends InheritableField<T> ? null : never)
} & { readonly [I in InputName<T>]?: ValueOf<InputKinds<T>[I]> }

export type TraitInputs = { readonly [T in TraitName]?: TraitInput<T> }

export type SetChange = { readonly target: Target } & TraitInputs

export type AddChange = {
  readonly kind: "shape"
  readonly slide: SlideId
  readonly box?: Box
  readonly text?: TraitInput<"text">
}

export type ScopedElement = {
  readonly node: ElementId
  readonly facts: ElementFacts
  readonly kept: readonly DesignKey[]
  readonly value: string | null
  readonly box: Box | null
}

export type Scope = {
  readonly expand: (target: Target) => readonly ElementId[] | "indexing"
  readonly view: (node: ElementId) => ScopedElement | undefined
}

export type PlanRefusal = "kind" | "group-box" | "kept" | "indexing" | "dead"

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

function written(trait: TraitName, key: string): FieldKey {
  return `${trait}.${inputOf(trait, key) ? "value" : key}` as FieldKey
}

function namedTraits(change: TraitInputs): readonly (readonly [TraitName, Loose])[] {
  return traitNames.flatMap((trait) => {
    const input: Loose | undefined = change[trait]
    return input === undefined || Object.keys(input).length === 0 ? [] : [[trait, input] as const]
  })
}

export function namedFields(change: TraitInputs): readonly FieldKey[] {
  const fields = namedTraits(change).flatMap(([trait, input]) => Object.keys(input).map((key) => written(trait, key)))
  return [...new Set(fields)]
}

function refusalOf(view: ScopedElement, trait: TraitName, input: Loose): PlanRefusal | null {
  const taken = takes(view.facts)
  const unset = Object.entries(input).some(([key, value]) => value === null && !inheritable(trait, key))
  if (unset || Object.keys(input).some((key) => !taken.includes(written(trait, key))))
    return view.facts.grouped && trait === "box" ? "group-box" : "kind"
  return Object.keys(input).some((key) => keptRefuses(view.kept, trait, key)) ? "kept" : null
}

function shownText(value: string): TextValue {
  return readTextValue(value) ?? (value === "" ? [] : [{ from: 0, runs: [{ from: 0, text: value }] }])
}

const runKeys = ["color", "size", "bold", "italic", "underline"] as const
const paragraphKeys = ["align", "bullet"] as const

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

function traitPatch(trait: TraitName, input: Loose, view: ScopedElement): Readonly<Record<string, FieldEdit<unknown>>> {
  const fields = trait === "box" ? { ...wholeBox(view.box), ...input } : input
  const edits: Record<string, FieldEdit<unknown>> = {}
  for (const [key, value] of Object.entries(fields))
    if (!inputOf(trait, key)) edits[key] = value === null ? "inherit" : { set: value }
  if (!Object.keys(input).some((key) => inputOf(trait, key))) return edits
  const base = typeof input.value === "string" ? input.value : (view.value ?? "")
  return { ...edits, value: { set: restyled(base, input) } }
}

function planNode(change: TraitInputs, view: ScopedElement): NodeRow | readonly ChangeRefusal[] {
  const named = namedTraits(change)
  const refusals = named.flatMap(([trait, input]) => {
    const code = refusalOf(view, trait, input)
    return code === null ? [] : [{ node: view.node, trait, code }]
  })
  if (refusals.length > 0) return refusals
  const patch = Object.fromEntries(named.map(([trait, input]) => [trait, traitPatch(trait, input, view)]))
  return { node: view.node, row: { v: format, patch: patch as ElementPatch } }
}

export function planChange(change: SetChange, scope: Scope): PlannedChange {
  const nodes = scope.expand(change.target)
  if (nodes === "indexing" || nodes.length === 0)
    return { ok: false, refusals: [{ node: null, trait: null, code: nodes === "indexing" ? "indexing" : "dead" }] }
  const rows: NodeRow[] = []
  const refusals: ChangeRefusal[] = []
  for (const node of nodes) {
    const view = scope.view(node)
    const planned = view === undefined ? [{ node, trait: null, code: "dead" as const }] : planNode(change, view)
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
  return slideKind(node) !== null && slideOrder(register).includes(shapeOf(node).slide)
}

function expanded(register: Register, target: Target): readonly ElementId[] | "indexing" {
  if ("role" in target) return expandRole(register, target.role, target.slide)
  if (!("node" in target)) {
    const node = slideNode(target.slide, "slide")
    return slideOwned(register, node) && present(register, node) ? [node] : []
  }
  const known = indexReady(register) || openingElement(register, target.node) !== undefined
  return known || slideOwned(register, target.node) ? [target.node] : "indexing"
}

export function registerScope(register: Register): Scope {
  return {
    expand: (target) => expanded(register, target),
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
      }
    },
  }
}
