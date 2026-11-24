import { type Color, readColor } from "../index.js"
import { boolean, finite, matching, reject, words } from "../read-kit.js"

export type Scalar = boolean | number | string | null
export type Value = Scalar | ValueRecord | Values
export type ValueRecord = { readonly [key: string]: Value }
export type Values = readonly Value[]

export const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value)

export function record(raw: unknown): Readonly<Record<string, unknown>> {
  if (typeof raw !== "object" || raw === null || isList(raw)) return reject()
  return raw as Readonly<Record<string, unknown>>
}

export function entries(raw: unknown, max: number): readonly (readonly [string, unknown])[] {
  const found = record(raw)
  const pairs: [string, unknown][] = []
  for (const key in found) {
    if (!Object.hasOwn(found, key)) continue
    if (pairs.length >= max) return reject("limit")
    pairs.push([key, found[key]])
  }
  return pairs
}

export const name = matching(/^[A-Za-z][\w-]*$/, 32)
export const id = matching(/^[\w-]+$/, 32)
export const path = matching(/^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*$/, 256)
export const numeric = finite(-1e15, 1e15)
export const wordsWithin = (max: number) => {
  const read = words(max)
  return (raw: unknown): string => (typeof raw === "string" && raw.length > max ? reject("limit") : read(raw))
}
export const string = wordsWithin(512)
export const color = (raw: unknown): Color => readColor(raw) ?? reject()

export const scalar = (raw: unknown): Scalar => {
  if (raw === null) return null
  if (typeof raw === "number") return numeric(raw)
  if (typeof raw === "string") return string(raw)
  return boolean(raw)
}

export const token = (raw: unknown): Exclude<Scalar, null> | Color =>
  typeof raw === "object" ? color(raw) : (scalar(raw) ?? reject())

export function budget(units: number): (cost?: number) => void {
  return (cost = 1) => {
    units -= cost
    if (units < 0) reject("limit")
  }
}

export function checkDepth(depth: number): void {
  if (depth > 32) reject("limit")
}
