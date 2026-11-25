import { resolveColor, tinted } from "../color.js"
import type { Hex } from "../paint.js"
import { integer } from "../read-kit.js"
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

export function colorSelection([selection, keys, accent, neutral]: Values, charge: Charge) {
  const focus = valueList(selection)
  if (focus.length === 0) return color(accent)
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
  const candidates = valueList(keys)
  charge(candidates.length)
  return color(candidates.some((key) => selected.has(key)) ? accent : neutral)
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

export function rampLightness(hex: Hex) {
  const [r = 0, g = 0, b = 0] = linearChannels(hex)
  return (
    0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) +
    0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) -
    0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  )
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

const rampCapacity = 3
const greySlot = (position: number) => 1 + ((position - 1) % (rampCapacity - 1))

export function paletteRamp([index, size, accent, neutral, labelled]: Values, theme: Theme, report?: ReportFinding) {
  const count = integer(1, 100)(size)
  const position = integer(0, count - 1)(index)
  if (position === 0) {
    if (count > rampCapacity) report?.({ kind: "many-series", count, capacity: rampCapacity })
    return color(accent)
  }
  const base = color(neutral)
  const hex = resolveColor(base, theme)
  const background = luminance(theme.colors.background)
  const light = background > Math.sqrt(1.05 * 0.05) - 0.05
  const direction = light ? -1 : 1
  const contrast = labelled === true ? 2.2 : 3
  const target = light ? (background + 0.05) / contrast - 0.05 : (background + 0.05) * contrast - 0.05
  const first = firstTint(hex, (shade) => (luminance(shade) - target) * direction >= 0, direction)
  const lightness = rampLightness(tinted(hex, first))
  const tint =
    greySlot(position) === 1
      ? first
      : firstTint(hex, (shade) => (rampLightness(shade) - lightness) * direction >= 0.06, direction)
  if (typeof base !== "string" && (base.tint ?? 0) === 0) return { ...base, tint }
  return tinted(hex, tint)
}

export function rampSlots([rows, focus]: Values, charge: Charge, report: ReportFinding) {
  const source = valueList(rows)
  const requested = valueList(focus)
  charge(source.length + requested.length)
  const keys = source.map((row) => string(record(row).id))
  const available = new Set(keys)
  const selected = new Set(requested.filter((id) => typeof id === "string" && available.has(id)))
  if (selected.size === 0 && keys[0] !== undefined) selected.add(keys[0])
  let muted = 0
  const indices = keys.map((key) => {
    if (selected.has(key)) return 0
    muted += 1
    return greySlot(muted)
  })
  const count = muted + 1
  if (count > rampCapacity) report({ kind: "many-series", count, capacity: rampCapacity })
  return { indices, count: Math.min(count, rampCapacity) }
}
