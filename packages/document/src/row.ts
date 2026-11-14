import type { Box } from "./box.js"
import { format, type StoredRead } from "./format.js"
import { onlyKeys, record } from "./plain-object.js"
import { traitNames, traits, type FieldKey, type FieldName, type FieldValue, type TraitName } from "./traits.js"
import type { Value } from "./value.js"
import { readValue, type AnyKind } from "./value-kind.js"

export type FieldEdit<V> = { readonly set: V } | "inherit" | "opening"

export type TraitPatch<T extends TraitName> = { readonly [F in FieldName<T>]?: FieldEdit<FieldValue<T, F>> }

export type ElementPatch = { readonly [T in TraitName]?: TraitPatch<T> }

export type Row = { readonly v: number; readonly patch: ElementPatch }

export type ValueHolder = "text" | "notes" | "table"

type Loose = Readonly<Record<string, Readonly<Record<string, FieldEdit<unknown>>> | undefined>>

const payload = { ok: false, refusal: "payload" } as const

function heldPatch(holder: ValueHolder, value: string): ElementPatch {
  const edit = { value: { set: value } }
  if (holder === "notes") return { notes: edit }
  if (holder === "table") return { table: edit }
  return { text: edit }
}

function boxPatch(box: Box): ElementPatch {
  return { box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } } }
}

export function rowOf(value: Value, holder: ValueHolder): Row {
  if (value.v !== undefined) return { v: value.v, patch: value.patch }
  return { v: 1, patch: value.property === "box" ? boxPatch(value.value) : heldPatch(holder, value.value) }
}

function readBox(raw: unknown): Box | null {
  const stored = record(raw)
  if (stored === null || !onlyKeys(stored, ["x", "y", "cx", "cy"])) return null
  const { x, y, w, h } = traits.box.fields
  const box = {
    x: readValue(x, stored.x),
    y: readValue(y, stored.y),
    cx: readValue(w, stored.cx),
    cy: readValue(h, stored.cy),
  }
  return box.x === null || box.y === null || box.cx === null || box.cy === null
    ? null
    : { x: box.x, y: box.y, cx: box.cx, cy: box.cy }
}

function readEdit(kind: AnyKind, raw: unknown): FieldEdit<unknown> | null {
  if (raw === "inherit" || raw === "opening") return raw
  const edit = record(raw)
  if (edit === null || !onlyKeys(edit, ["set"])) return null
  const value = readValue(kind, edit.set)
  return value === null ? null : { set: value }
}

function readFields(trait: TraitName, raw: unknown): Readonly<Record<string, FieldEdit<unknown>>> | null {
  const fields = record(raw)
  const declared: Readonly<Record<string, AnyKind>> = traits[trait].fields
  if (fields === null || Object.keys(fields).length === 0) return null
  const read: Record<string, FieldEdit<unknown>> = {}
  for (const [field, edit] of Object.entries(fields)) {
    const kind = Object.hasOwn(declared, field) ? declared[field] : undefined
    const value = kind === undefined ? null : readEdit(kind, edit)
    if (value === null) return null
    read[field] = value
  }
  return read
}

function readPatch(raw: unknown): ElementPatch | null {
  const patch = record(raw)
  if (patch === null || Object.keys(patch).length === 0) return null
  const read: Record<string, Readonly<Record<string, FieldEdit<unknown>>>> = {}
  for (const [trait, fields] of Object.entries(patch)) {
    const name = traitNames.find((each) => each === trait)
    const value = name === undefined ? null : readFields(name, fields)
    if (value === null) return null
    read[trait] = value
  }
  return read as ElementPatch
}

function readStamped(v: unknown, raw: unknown): StoredRead<Row> {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 2) return payload
  if (v > format) return { ok: false, refusal: "newer" }
  const patch = readPatch(raw)
  return patch === null ? payload : { ok: true, value: { v, patch } }
}

export function readRow(raw: unknown, holder: ValueHolder): StoredRead<Row> {
  const stored = record(raw)
  if (stored === null) return payload
  if (Object.hasOwn(stored, "v")) return readStamped(stored.v, stored.patch)
  if (stored.property === "box") {
    const box = readBox(stored.value)
    return box === null ? payload : { ok: true, value: { v: 1, patch: boxPatch(box) } }
  }
  if (stored.property !== undefined) return payload
  const value = readValue(traits[holder].fields.value, stored.value)
  return value === null ? payload : { ok: true, value: { v: 1, patch: heldPatch(holder, value) } }
}

function loose(patch: ElementPatch): Loose {
  return patch
}

export function netPatch(rows: readonly Row[]): ElementPatch {
  const net: Record<string, Readonly<Record<string, FieldEdit<unknown>>>> = {}
  for (const { patch } of rows) {
    for (const [trait, fields] of Object.entries(loose(patch))) net[trait] = { ...net[trait], ...fields }
  }
  return net as ElementPatch
}

function held(net: ElementPatch, trait: string, field: string): FieldEdit<unknown> {
  return loose(net)[trait]?.[field] ?? "opening"
}

export function beforeOf(net: ElementPatch, after: ElementPatch): ElementPatch {
  const before: Record<string, Readonly<Record<string, FieldEdit<unknown>>>> = {}
  for (const [trait, fields] of Object.entries(loose(after))) {
    before[trait] = Object.fromEntries(Object.keys(fields ?? {}).map((field) => [field, held(net, trait, field)]))
  }
  return before as ElementPatch
}

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        same((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  )
}

export function shows(net: ElementPatch, wanted: ElementPatch): boolean {
  return Object.entries(loose(wanted)).every(([trait, fields]) =>
    Object.entries(fields ?? {}).every(([field, edit]) => same(held(net, trait, field), edit)),
  )
}

export function fieldsOf(patch: ElementPatch): readonly FieldKey[] {
  return Object.entries(loose(patch)).flatMap(([trait, fields]) =>
    Object.keys(fields ?? {}).map((field) => `${trait}.${field}` as FieldKey),
  )
}

function setOf<V>(edit: FieldEdit<V> | undefined): V | undefined {
  return edit === undefined || typeof edit !== "object" ? undefined : edit.set
}

function boxOf(patch: ElementPatch): Box | null {
  const fields = patch.box
  const box = { x: setOf(fields?.x), y: setOf(fields?.y), cx: setOf(fields?.w), cy: setOf(fields?.h) }
  return box.x === undefined || box.y === undefined || box.cx === undefined || box.cy === undefined
    ? null
    : { x: box.x, y: box.y, cx: box.cx, cy: box.cy }
}

export function formatOne(patch: ElementPatch, holder: ValueHolder): readonly Value[] | null {
  const values: Value[] = []
  const value = setOf(patch[holder]?.value)
  if (value !== undefined) values.push({ value })
  const box = boxOf(patch)
  if (box !== null) values.push({ property: "box", value: box })
  const stored = (value === undefined ? 0 : 1) + (box === null ? 0 : 4)
  return fieldsOf(patch).length === stored ? values : null
}
