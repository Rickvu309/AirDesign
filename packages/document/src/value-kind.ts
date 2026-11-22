import { readLinkTarget } from "./link-target.js"
import { assetMedia, readAsset } from "./asset-ref.js"
import { readColor, type Color, type MappedSlot, type TemplateColor } from "./color.js"
import { coordinates } from "./box.js"
import { readElementId } from "./element-id.js"
import { bytesOf } from "./limits.js"
import { record as plain } from "./plain-object.js"
import { sizeCeiling, sizeFloor } from "./text-size.js"

export type NumberUnit = "emu" | "angle" | "fraction" | "hundredth-point" | "count"

export type Desc =
  | { readonly kind: "number"; readonly unit: NumberUnit; readonly min: number; readonly max: number }
  | { readonly kind: "flag" }
  | { readonly kind: "words"; readonly max: number }
  | { readonly kind: "choice"; readonly options: readonly string[]; readonly custom?: Desc }
  | { readonly kind: "mark" }
  | { readonly kind: "color" }
  | { readonly kind: "hex" }
  | { readonly kind: "alpha"; readonly over: string }
  | { readonly kind: "record"; readonly fields: Readonly<Record<string, Desc>> }
  | { readonly kind: "union"; readonly cases: Readonly<Record<string, Desc>>; readonly plain: string | null }
  | { readonly kind: "list"; readonly item: Desc; readonly min: number; readonly max: number }
  | { readonly kind: "named"; readonly item: Desc; readonly max: number }
  | { readonly kind: "text" }
  | { readonly kind: "asset"; readonly media?: true }
  | { readonly kind: "node" }
  | { readonly kind: "link" }

declare const valueMark: unique symbol
declare const agentMark: unique symbol
declare const markBrand: unique symbol

export type ValueKind<V, A> = { readonly desc: Desc; readonly [valueMark]?: V; readonly [agentMark]?: A }
export type AnyKind = ValueKind<unknown, unknown>
export type ValueOf<K> = K extends ValueKind<infer V, unknown> ? V : never
export type AgentOf<K> = K extends ValueKind<unknown, infer A> ? A : never
export type Fields = Readonly<Record<string, AnyKind>>

export type Alpha = number & { readonly alpha: true }
export type MarkAgent = { readonly [markBrand]: true }
export type MarkKind = ValueKind<true, MarkAgent>

type Slot = TemplateColor | MappedSlot
export type AgentColor = Slot | `#${string}` | `${Slot} ${string}` | `#${string} ${string}`

function kind<V, A>(desc: Desc): ValueKind<V, A> {
  return { desc }
}

function whole(unit: NumberUnit, min: number, max: number): ValueKind<number, number> {
  return kind({ kind: "number", unit, min, max })
}

export const emu = whole("emu", coordinates.lowest, coordinates.highest)
export const size = whole("emu", 0, coordinates.highest)
export const angle = whole("angle", 0, 21_599_999)
export const fraction = whole("fraction", 0, 100_000)
export const typeSize = whole("hundredth-point", sizeFloor, sizeCeiling)
export const flag = kind<boolean, boolean>({ kind: "flag" })
export const mark: MarkKind = kind<true, MarkAgent>({ kind: "mark" })
export const color = kind<Color, AgentColor>({ kind: "color" })
export const hex = kind<string, `#${string}`>({ kind: "hex" })

export function sizeUpTo(max: number): ValueKind<number, number> {
  return whole("emu", 0, max)
}

export function fractionWithin(min: number, max: number): ValueKind<number, number> {
  return whole("fraction", min, max)
}

export function pointsWithin(min: number, max: number): ValueKind<number, number> {
  return whole("hundredth-point", min, max)
}

export function pointsUpTo(max: number): ValueKind<number, number> {
  return whole("hundredth-point", 0, max)
}

export function count(min: number, max: number): ValueKind<number, number> {
  return whole("count", min, max)
}

export function words(max: number): ValueKind<string, string> {
  return kind({ kind: "words", max })
}

export function choice<const O extends string>(options: readonly [O, ...O[]]): ValueKind<O, O> {
  return kind({ kind: "choice", options })
}

export function customChoice<const O extends string, const C extends AnyKind>(
  options: readonly [O, ...O[]],
  custom: C,
): ValueKind<O | { readonly custom: ValueOf<C> }, O | { readonly custom: AgentOf<C> }> {
  return kind({ kind: "choice", options, custom: custom.desc })
}

export function alphaOver<const F extends string>(over: F): ValueKind<Alpha, never> & { readonly over: F } {
  return { desc: { kind: "alpha", over }, over }
}

export function record<const F extends Fields>(
  fields: F,
): ValueKind<{ readonly [K in keyof F]: ValueOf<F[K]> }, { readonly [K in keyof F]: AgentOf<F[K]> }> {
  const descs: Record<string, Desc> = {}
  for (const [name, field] of Object.entries(fields)) descs[name] = field.desc
  return kind({ kind: "record", fields: descs })
}

type CaseValue<C extends Fields> = { [K in keyof C]: { readonly [P in K]: ValueOf<C[K]> } }[keyof C]
type MarkNames<C extends Fields> = { [K in keyof C]: C[K] extends ValueKind<unknown, MarkAgent> ? K : never }[keyof C]
type CaseObjects<C extends Fields> = {
  [K in keyof C]: C[K] extends ValueKind<unknown, MarkAgent> ? never : { readonly [P in K]: AgentOf<C[K]> }
}[keyof C]
type Bare<A> = A extends string | number ? A : never

export type UnionAgent<C extends Fields, P extends keyof C | null> =
  | (MarkNames<C> & string)
  | (P extends keyof C ? Bare<AgentOf<C[P]>> : never)
  | CaseObjects<C>

export function union<const C extends Fields, const P extends (keyof C & string) | null = null>(
  cases: C,
  bare?: P,
): ValueKind<CaseValue<C>, UnionAgent<C, P>> {
  const descs: Record<string, Desc> = {}
  for (const [name, item] of Object.entries(cases)) descs[name] = item.desc
  return kind({ kind: "union", cases: descs, plain: bare ?? null })
}

export function list<const I extends AnyKind>(
  item: I,
  min: number,
  max: number,
): ValueKind<readonly ValueOf<I>[], readonly AgentOf<I>[]> {
  return kind({ kind: "list", item: item.desc, min, max })
}

export function named<const I extends AnyKind>(
  item: I,
  max: number,
): ValueKind<Readonly<Record<string, ValueOf<I>>>, Readonly<Record<string, AgentOf<I>>>> {
  return kind({ kind: "named", item: item.desc, max })
}

export function custom<V, A>(name: "text" | "asset" | "node" | "link"): ValueKind<V, A> {
  return kind({ kind: name })
}

export const pictureSource = kind<string, string>({ kind: "asset", media: true })

const unread = Symbol("unread")

const hexDigits = /^[0-9A-F]{6}$/

function readWhole(raw: unknown, min: number, max: number): number | typeof unread {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < min || raw > max) return unread
  return Object.is(raw, -0) ? 0 : raw
}

function readFields(fields: Readonly<Record<string, Desc>>, raw: unknown): unknown {
  const value = plain(raw)
  const names = Object.keys(fields)
  if (value === null || Object.keys(value).length !== names.length) return unread
  const read: Record<string, unknown> = {}
  for (const name of names) {
    const field = fields[name]
    if (field === undefined || !Object.hasOwn(value, name)) return unread
    const item = readDesc(field, value[name])
    if (item === unread) return unread
    read[name] = item
  }
  return read
}

function readCase(cases: Readonly<Record<string, Desc>>, raw: unknown): unknown {
  const value = plain(raw)
  const [name, ...rest] = value === null ? [] : Object.keys(value)
  const desc = name === undefined ? undefined : cases[name]
  if (value === null || name === undefined || desc === undefined || rest.length > 0) return unread
  const item = readDesc(desc, value[name])
  return item === unread ? unread : { [name]: item }
}

function readItems(item: Desc, raw: unknown, min: number, max: number): unknown {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return unread
  const read = raw.map((each) => readDesc(item, each))
  return read.includes(unread) ? unread : read
}

function readNamed(item: Desc, raw: unknown, max: number): unknown {
  const value = plain(raw)
  if (value === null || Object.keys(value).length > max) return unread
  const read: Record<string, unknown> = {}
  for (const [name, each] of Object.entries(value)) {
    const got = readDesc(item, each)
    if (got === unread) return unread
    read[name] = got
  }
  return read
}

function readDesc(desc: Desc, raw: unknown): unknown {
  switch (desc.kind) {
    case "number":
      return readWhole(raw, desc.min, desc.max)
    case "alpha":
      return readWhole(raw, 0, 100_000)
    case "flag":
      return typeof raw === "boolean" ? raw : unread
    case "mark":
      return raw === true ? raw : unread
    case "words":
      return typeof raw === "string" && bytesOf(raw) <= desc.max ? raw : unread
    case "choice":
      if (typeof raw === "string" && desc.options.includes(raw)) return raw
      return desc.custom === undefined ? unread : readFields({ custom: desc.custom }, raw)
    case "color":
      return readColor(raw) ?? unread
    case "hex":
      return typeof raw === "string" && hexDigits.test(raw) ? raw : unread
    case "record":
      return readFields(desc.fields, raw)
    case "union":
      return readCase(desc.cases, raw)
    case "list":
      return readItems(desc.item, raw, desc.min, desc.max)
    case "named":
      return readNamed(desc.item, raw, desc.max)
    case "link":
      return readLinkTarget(raw) ?? unread
    case "node":
      return readElementId(raw) ?? unread
    case "asset":
      return (
        readAsset(raw) ?? (desc.media === true && typeof raw === "string" && assetMedia(raw) !== null ? raw : unread)
      )
    case "text":
      return typeof raw === "string" ? raw : unread
  }
}

export function readValue<V>(field: ValueKind<V, unknown>, raw: unknown): V | null {
  const read = readDesc(field.desc, raw)
  return read === unread ? null : (read as V)
}
