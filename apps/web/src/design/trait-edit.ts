import {
  alphaKeys,
  beforeOf,
  formatOne,
  landedPatch,
  planChange,
  readTableValue,
  registerScope,
  slideKind,
  valueHolder,
  type ElementId,
  type ElementPatch,
  type FieldEdit,
  type FormatOneValue,
  type NodeStep,
  type Register,
  type Row,
  type Scope,
  type ScopedElement,
  type SetChange,
  type TraitName,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { indexPackage, type ReadShape } from "@airdesign/pptx"
import { textValue } from "@airdesign/render"
import type { UndoName } from "@/copy/undo-copy"
import { valueStorable } from "@/slide-paint"
import { tableEditName } from "@/table-edit"
import type { UndoEntry } from "@/undo-list"
import { boxName } from "@/undo-names"

type Parts = ReadonlyMap<string, Uint8Array>

type Loose = Readonly<Record<string, Readonly<Record<string, FieldEdit<unknown>>> | undefined>>

const openings = new WeakMap<Parts, ReturnType<typeof indexPackage>>()

function indexed(parts: Parts, register: Register): Register {
  const opening = openings.get(parts) ?? indexPackage(parts)
  openings.set(parts, opening)
  const stored = register.index?.templates
  const fresh = opening.templates ?? []
  const templates =
    stored === undefined
      ? undefined
      : [
          ...stored.map((style) => fresh.find((each) => each.id === style.id) ?? style),
          ...fresh.filter((style) => stored.every((each) => each.id !== style.id)),
        ]
  return {
    ...register,
    index: {
      ...opening,
      total: opening.elements.length,
      pages: [],
      ...(templates === undefined ? {} : { templates }),
    },
  }
}

export function deviceScope(parts: Parts, register: Register): Scope {
  return registerScope(indexed(parts, register))
}

export function valueFits(parts: Parts, shape: ReadShape | undefined, value: string): boolean {
  if (shape === undefined) return false
  if (shape.contentKind === "table") return readTableValue(value) !== null
  return valueStorable(parts, shape, textValue(value))
}

function shownFields(view: ScopedElement): Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>> {
  const value = { value: view.value ?? "" }
  const box = view.box === null ? undefined : { x: view.box.x, y: view.box.y, w: view.box.cx, h: view.box.cy }
  return { box, text: value, table: value, notes: value }
}

function heldPatch(view: ScopedElement, after: ElementPatch): ElementPatch | null {
  const shown = shownFields(view)
  const before: Record<string, Record<string, FieldEdit<unknown>>> = {}
  for (const [trait, fields] of Object.entries(after as Loose)) {
    for (const field of Object.keys(fields ?? {})) {
      const value = shown[trait]?.[field]
      if (value === undefined) return null
      before[trait] = { ...before[trait], [field]: { set: value } }
    }
  }
  return before as ElementPatch
}

function plainOf(value: string): string {
  return textValue(value)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n")
}

function nameOf(view: ScopedElement, values: readonly FormatOneValue[]): UndoName {
  const [value] = values
  if (value === undefined) return "text"
  if (value.property === "box") return (view.box === null ? null : boxName(view.box, value.value)) ?? "move"
  if (slideKind(view.node) === "notes") return "notes"
  const table = view.facts.kind === "table" ? tableEditName(view.value ?? "", value.value) : null
  if (table !== null) return table
  return plainOf(value.value) === plainOf(view.value ?? "") ? "format" : "text"
}

export type ChangingDeck = {
  readonly id: string
  readonly parts: () => Parts
  readonly floor: (node: ElementId) => string
  readonly file: (node: ElementId) => string | null
  readonly fits: (node: ElementId, value: string) => boolean
  readonly hold: () => () => void
  readonly record: (entry: UndoEntry) => void
  readonly show: (register: Register) => void
}

type Planned = {
  readonly node: ElementId
  readonly step: NodeStep
  readonly name: UndoName
} & ({ readonly values: readonly FormatOneValue[] } | { readonly row: Row })

const rowNames: Partial<Readonly<Record<TraitName, UndoName>>> = {
  fills: "fill",
  line: "line",
  effects: "effects",
  body: "text-box",
  geometry: "shape",
  image: "picture",
  crop: "crop",
  connection: "connector",
}

const identityNames: Readonly<Record<string, UndoName>> = { name: "rename", alt: "alt-text", hidden: "hide" }

function faded(row: Row): boolean {
  const fields = Object.entries(row.patch).flatMap(([trait, edits]) =>
    Object.keys(edits ?? {}).map((field) => `${trait}.${field}`),
  )
  return fields.length > 0 && fields.every((field) => (alphaKeys as readonly string[]).includes(field))
}

function rowName(node: ElementId, row: Row): UndoName {
  if (row.patch.show?.skipped !== undefined)
    return typeof row.patch.show.skipped === "object" && row.patch.show.skipped.set ? "skip-slide" : "unskip-slide"
  if (row.patch.transition !== undefined) return "transition"
  if (row.patch.template !== undefined) return "template"
  if (slideKind(node) === "slide") return "background"
  const theme = row.patch.theme
  if (theme !== undefined) {
    const names = Object.keys(theme)
    if (names.length === 1 && names[0] === "textStyle") return "text-style"
    return theme.major === undefined && theme.minor === undefined ? "theme-color" : "theme-font"
  }
  if (faded(row)) return "opacity"
  if (row.patch.connection !== undefined) return "connector"
  const box = row.patch.box
  if (box?.rot !== undefined) return "rotate"
  if (box?.flipH !== undefined || box?.flipV !== undefined) return "flip"
  if (row.patch.crop !== undefined) return "crop"
  const [named] = Object.keys(row.patch.identity ?? {})
  if (named !== undefined && identityNames[named] !== undefined) return identityNames[named]
  const [trait] = Object.keys(row.patch) as TraitName[]
  return (trait === undefined ? undefined : rowNames[trait]) ?? "format"
}

function landedBefore(register: Register, node: ElementId, after: ElementPatch): ElementPatch {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  return beforeOf(body === undefined ? {} : landedPatch(body, "text"), after)
}

function planned(deck: ChangingDeck, register: Register, change: SetChange): readonly Planned[] | null {
  const opened = indexed(deck.parts(), register)
  const scope = registerScope(opened)
  const plan = planChange(change, scope)
  if (!plan.ok) return null
  const rows: Planned[] = []
  for (const { node, row } of plan.rows) {
    const shown = scope.view(node)
    const view = shown === undefined ? undefined : { ...shown, value: shown.value ?? deck.file(node) }
    const values = formatOne(row.patch, valueHolder(opened, node, "person"))
    if (view === undefined) return null
    if (values === null) {
      const before = landedBefore(opened, node, row.patch)
      const text = row.patch.text?.value
      if (text !== undefined && typeof text === "object" && !deck.fits(node, text.set)) return null
      rows.push({ node, row, step: { node, before, after: row.patch }, name: rowName(node, row) })
      continue
    }
    const before = heldPatch(view, row.patch)
    if (before === null) return null
    if (values.some((value) => value.property !== "box" && !deck.fits(node, value.value))) return null
    rows.push({ node, values, step: { node, before, after: row.patch }, name: nameOf(view, values) })
  }
  return rows
}

async function stored(deck: ChangingDeck, row: Planned): Promise<boolean> {
  const live = connect(memoryRemote())
  if ("row" in row) return (await live.enqueueRow(deck.id, row.row, row.node, deck.floor(row.node))).ok
  for (const value of row.values) {
    const floor = deck.floor(row.node)
    const kept =
      value.property === "box"
        ? await live.enqueueBox(deck.id, value.value, row.node, floor)
        : await live.enqueue(deck.id, value.value, row.node, floor)
    if (!kept.ok) return false
  }
  return true
}

export async function applyChange(deck: ChangingDeck, change: SetChange | readonly SetChange[]): Promise<boolean> {
  const release = deck.hold()
  try {
    const opened = await connect(memoryRemote()).openDeck(deck.id)
    const changes = Array.isArray(change) ? change : [change]
    const plans = opened.ok ? changes.map((each) => planned(deck, opened.register, each)) : [null]
    const rows = plans.some((plan) => plan === null) ? null : plans.flatMap((plan) => plan ?? [])
    if (rows === null || rows.length === 0) return false
    const steps: NodeStep[] = []
    for (const row of rows) {
      if (!(await stored(deck, row))) break
      steps.push(row.step)
    }
    const name = rows[0]?.name
    if (name !== undefined && steps.length > 0) deck.record({ name, undoable: { steps } })
    const next = await connect(memoryRemote()).openDeck(deck.id)
    if (next.ok) deck.show(next.register)
    return steps.length === rows.length
  } finally {
    release()
  }
}
