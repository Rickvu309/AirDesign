import { resolveColor, tinted } from "../color.js"
import type { Hex } from "../paint.js"
import { integer, literal } from "../read-kit.js"
import type { Theme } from "../theme.js"
import type { ReportFinding } from "./findings.js"
import { type Charge, type Value, type Values, color, record, string, valueList } from "./values.js"

export function matchingFocus([selection, keys, idField, valueField]: Values, charge: Charge, report: ReportFinding) {
  const requested = valueList(selection)
  if (requested.length === 0) return requested
  const rows = valueList(keys)
  charge(requested.length + rows.length)
  const idKey = idField === undefined ? undefined : string(idField)
  const valueKey = valueField === undefined ? undefined : string(valueField)
  const available = rows.flatMap((value) => {
    if (idKey === undefined) return [string(value)]
    const row = record(value)
    if (valueKey !== undefined && (row[valueKey] === null || row[valueKey] === undefined)) return []
    return [string(row[idKey])]
  })
  const marks = new Set(available)
  const ids = requested.map((value) => string(value))
  const matches = ids.filter((id) => marks.has(id))
  if (matches.length !== ids.length)
    report({ kind: "focus-missing", unknown: ids.filter((id) => !marks.has(id)), available })
  return matches
}

const selectionCache = new WeakMap<Charge, WeakMap<Values, ReadonlySet<Value>>>()

export function containsValue([selection, key]: Values, charge: Charge) {
  const focus = valueList(selection)
  let cache = selectionCache.get(charge)
  if (cache === undefined) {
    cache = new WeakMap()
    selectionCache.set(charge, cache)
  }
  let selected = cache.get(focus)
  if (selected === undefined) {
    charge(focus.length)
    selected = new Set(focus)
    cache.set(focus, selected)
  }
  return key !== undefined && selected.has(key)
}

function linearChannels(hex: Hex) {
  return [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
}

function luminance(hex: Hex) {
  const [r = 0, g = 0, b = 0] = linearChannels(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (left: Hex, right: Hex) => {
  const [low, high] = [luminance(left), luminance(right)].sort((a, b) => a - b)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

function oklab(hex: Hex) {
  const [r = 0, g = 0, b = 0] = linearChannels(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const
}

export const rampLightness = (hex: Hex) => oklab(hex)[0]

const apart = (left: Hex, right: Hex) => {
  const a = oklab(left)
  const b = oklab(right)
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 15
}

function firstTint(base: Hex, passes: (hex: Hex) => boolean, direction: number) {
  let lo = -1
  let hi = 1
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (passes(tinted(base, mid * direction))) hi = mid
    else lo = mid
  }
  return hi * direction
}

type Greys = { readonly first: number; readonly second: number | undefined }

const greyCache = new WeakMap<Theme, Map<string, Greys>>()

function greysFor(theme: Theme, accent: Hex, neutral: Hex, labelled: boolean): Greys {
  const key = `${accent}${neutral}${String(labelled)}`
  let cache = greyCache.get(theme)
  if (cache === undefined) {
    cache = new Map()
    greyCache.set(theme, cache)
  }
  const known = cache.get(key)
  if (known !== undefined) return known
  const { background } = theme.colors
  const ground = luminance(background)
  const direction = ground > Math.sqrt(1.05 * 0.05) - 0.05 ? -1 : 1
  const floor = labelled ? 2.2 : 3
  const target = direction < 0 ? (ground + 0.05) / floor - 0.05 : (ground + 0.05) * floor - 0.05
  const first = firstTint(neutral, (shade) => (luminance(shade) - target) * direction >= 0, direction)
  const heaviest = contrast(accent, background)
  const shade = (tint: number) => tinted(neutral, tint)
  const heavier = function* (from: number) {
    for (let tint = from + direction * 0.005; Math.abs(tint) <= 1; tint += direction * 0.005) yield tint
  }
  const pairFrom = (base: number): Greys | undefined => {
    const grey = shade(base)
    for (const tint of heavier(base)) {
      if (contrast(shade(tint), background) > heaviest) break
      if (apart(shade(tint), grey) && apart(shade(tint), accent)) return { first: base, second: tint }
    }
    return undefined
  }
  let pair = pairFrom(first)
  if (!labelled)
    for (const base of heavier(first)) {
      if (pair !== undefined || contrast(shade(base), background) > heaviest || !apart(shade(base), accent)) break
      pair = pairFrom(base)
    }
  const greys = pair ?? { first, second: undefined }
  cache.set(key, greys)
  return greys
}

const readArrangement = literal(["labelled", "circular"])

export function rampCapacity(theme: Theme) {
  return greysFor(theme, theme.colors.accent1, theme.colors.text2, false).second === undefined ? 2 : 3
}

const greySlot = (position: number, capacity: number) => 1 + ((position - 1) % (capacity - 1))

export function paletteRamp([index, size, accent, neutral, labelled]: Values, theme: Theme, report?: ReportFinding) {
  const count = integer(1, 100)(size)
  const position = integer(0, count - 1)(index)
  const base = color(neutral)
  const hex = resolveColor(base, theme)
  const greys = greysFor(theme, resolveColor(color(accent), theme), hex, labelled === true)
  const capacity = greys.second === undefined ? 2 : 3
  if (position === 0) {
    if (count > capacity) report?.({ kind: "many-series", count, capacity })
    return color(accent)
  }
  const tint = greySlot(position, 3) === 1 ? greys.first : (greys.second ?? greys.first)
  if (typeof base !== "string" && (base.tint ?? 0) === 0) return { ...base, tint }
  return tinted(hex, tint)
}

export function rampSlots([rows, focus, arrangement]: Values, charge: Charge, report: ReportFinding, theme: Theme) {
  const source = valueList(rows)
  const requested = valueList(focus)
  charge(source.length + requested.length)
  const keys = source.map((row) => string(record(row).id))
  const available = new Set(keys)
  const selected = new Set(requested.filter((id) => typeof id === "string" && available.has(id)))
  if (selected.size === 0 && keys[0] !== undefined) selected.add(keys[0])
  const capacity = rampCapacity(theme)
  const labelled = arrangement !== undefined
  const circular = labelled && readArrangement(arrangement) === "circular"
  const start = circular ? keys.findIndex((key) => selected.has(key)) : 0
  let muted = 0
  const indices: number[] = []
  for (let offset = 0; offset < keys.length; offset++) {
    const i = (start + offset) % keys.length
    const key = keys[i]
    if (key !== undefined && selected.has(key)) {
      indices[i] = 0
      if (circular) muted = 0
    } else {
      muted += 1
      indices[i] = greySlot(muted, capacity)
    }
  }
  if (circular) return { indices, count: capacity }
  const count = muted + 1
  if (!labelled && count > capacity) report({ kind: "many-series", count, capacity })
  return { indices, count: Math.min(count, capacity) }
}

export function rampFold([rows, focus, other]: Values, charge: Charge, report: ReportFinding, theme: Theme) {
  const source = valueList(rows)
  charge(source.length)
  const ids = source.map((row) => string(record(row).id))
  const ramped = (row: Value) => {
    const { color } = record(row)
    return color === null || color === undefined
  }
  const available = new Set(ids)
  const selected = new Set(valueList(focus).filter((id): id is string => typeof id === "string" && available.has(id)))
  const lead = source.find(ramped)
  if (selected.size === 0 && lead !== undefined) selected.add(string(record(lead).id))
  const muted = ids.filter((id, i) => ramped(source[i]!) && !selected.has(id))
  const capacity = rampCapacity(theme)
  const folded = new Set(muted.length < capacity ? [] : muted.slice(capacity - 2))
  const shown = [...source.filter((_, i) => !folded.has(ids[i]!)), ...(folded.size === 0 ? [] : [other ?? null])]
  if (folded.size > 0)
    report({
      kind: "advice",
      code: "series-folded",
      note: `Summed ${folded.size} series as Other. Show at most ${capacity} series, or split the chart to show each one.`,
    })
  const slots = rampSlots([shown.filter(ramped), [...selected]], charge, report, theme)
  let next = 0
  const indices = shown.map((row) => (ramped(row) ? (slots.indices[next++] ?? null) : null))
  return { rows: shown, folded: [...folded], slots: indices, count: slots.count }
}
