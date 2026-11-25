import { readColor } from "../color.js"
import { colorVars, type Color } from "../paint.js"
import type { Refusal } from "../refusal.js"
import { agentColor, boolean, detailOf, finite, list, matching, reject, words } from "../read-kit.js"

export type Scalar = boolean | number | string | null
export type Value = Scalar | ValueRecord | Values
export type ValueRecord = { readonly [key: string]: Value }
export type Values = readonly Value[]

export const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value)

export function record(raw: unknown): Readonly<Record<string, unknown>> {
  if (typeof raw !== "object" || raw === null || isList(raw)) return reject("shape", "An object.")
  return raw as Readonly<Record<string, unknown>>
}

export function entries(raw: unknown, max: number): readonly (readonly [string, unknown])[] {
  const found = record(raw)
  const pairs: [string, unknown][] = []
  for (const key in found) {
    if (!Object.hasOwn(found, key)) continue
    if (pairs.length >= max) return reject("limit", `At most ${max} fields.`)
    pairs.push([key, found[key]])
  }
  return pairs
}

export const name = matching(
  /^[A-Za-z][\w-]*$/,
  32,
  "A name of up to 32 letters, digits, underscores or dashes, starting with a letter.",
)
export const id = matching(/^[\w-]+$/, 32, "An ID of up to 32 letters, digits, underscores or dashes.")
const focusIds = list(id, 100)
export const readFocus = (raw: unknown) => [...new Set(focusIds(raw))]
export const path = matching(
  /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*$/,
  256,
  "A path of dot-separated names, up to 256 characters.",
)
export const numeric = finite(-1e15, 1e15)
export const wordsWithin = (max: number) => {
  const read = words(max)
  return (raw: unknown): string => {
    if (typeof raw === "string" && raw.length > max) return reject("limit", `At most ${max} UTF-8 bytes.`)
    try {
      return read(raw)
    } catch (thrown) {
      if (detailOf(thrown).refused === "limit") return reject("limit", `At most ${max} UTF-8 bytes.`)
      throw thrown
    }
  }
}
export const string = wordsWithin(512)
const themeColor = agentColor(new RegExp(`^(${colorVars.join("|")})([+-](100|[1-9][0-9]?))?$`), 16, "A theme colour.")
export function color(raw: unknown): Color {
  const parsed = readColor(raw)
  if (parsed !== undefined) return parsed
  if (typeof raw !== "string") return reject("shape", "A hex or theme colour.")
  const named = themeColor(raw)
  const base = colorVars.find(
    (entry) => entry === named || named.startsWith(`${entry}+`) || named.startsWith(`${entry}-`),
  )
  if (base === undefined) return reject("shape", "A hex or theme colour.")
  const tint = Number(named.slice(base.length)) / 100
  return tint === 0 ? { var: base } : { var: base, tint }
}

export const scalar = (raw: unknown): Scalar => {
  if (raw === null) return null
  if (typeof raw === "number") return numeric(raw)
  if (typeof raw === "string") return string(raw)
  return boolean(raw)
}

export const token = (raw: unknown): Exclude<Scalar, null> | Color =>
  typeof raw === "object" ? color(raw) : (scalar(raw) ?? reject("shape", "A string, number, boolean or colour."))

export type Charge = (cost?: number) => void

export function budget(units: number, form: string): Charge {
  return (cost = 1) => {
    units -= cost
    if (units < 0) reject("limit", form)
  }
}

export function checkDepth(depth: number): void {
  if (depth > 32) reject("limit", "At most 32 levels of nesting.")
}

export function componentRefusal(thrown: unknown): Refusal {
  const detail = detailOf(thrown)
  return {
    ...detail,
    field: detail.field ?? "$",
    form: detail.form ?? "A value allowed by the component grammar.",
  }
}

export const valueList = (value: Value | undefined): Values => (isList(value) ? value : reject("shape", "A list."))
