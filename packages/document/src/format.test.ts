import { describe, expect, it } from "vitest"
import { format, formatOf, newerFormat, stamps, converted, type Conversion } from "./format.js"
import { record } from "./plain-object.js"

it("keeps each stamp a whole number from 0", () => {
  for (const stamp of Object.values(stamps)) {
    expect(Number.isSafeInteger(stamp)).toBe(true)
    expect(stamp).toBeGreaterThanOrEqual(0)
  }
})

it("reads something stored with no format as format 1", () => {
  expect(formatOf({ kind: "pending" })).toBe(1)
  expect(formatOf(undefined)).toBe(1)
  expect(formatOf({ format: "2" })).toBe(1)
  expect(formatOf({ format: 1.5 })).toBe(1)
})

it("names a format above this build's as newer", () => {
  expect(formatOf({ format: format + 1 })).toBe(format + 1)
  expect(newerFormat({ format: format + 1 })).toBe(true)
  expect(newerFormat({ format })).toBe(false)
  expect(newerFormat({})).toBe(false)
})

describe("converted runs each conversion a stored value is older than, in the order the formats came", () => {
  const stampOf = (raw: Record<string, unknown>) => (typeof raw.v === "number" ? raw.v : 1)

  function renamed(trait: string, from: string, to: string, introduced: number, change = (edit: unknown) => edit) {
    return {
      introduced,
      convert(row: Record<string, unknown>): unknown {
        const fields = record(record(row.patch)?.[trait])
        if (fields === null || !Object.hasOwn(fields, from)) return row
        const { [from]: edit, ...rest } = fields
        const next = change(edit)
        return next === undefined
          ? null
          : { ...row, v: introduced, patch: { ...record(row.patch), [trait]: { ...rest, [to]: next } } }
      },
    }
  }

  const paints = renamed("fill", "value", "paints", 40, (edit) => {
    const set = record(edit)?.set
    return edit === "opening" || edit === "inherit" ? edit : set === undefined ? undefined : { set: [set] }
  })
  const lineHeight = renamed("text", "lineSpacing", "lineHeight", 50)
  const conversions: readonly Conversion<undefined>[] = [lineHeight, paints]
  const accent = { solid: { scheme: "accent1" } }

  it("turns a row from before both renames into today's names and stamps it with the last", () => {
    const row = {
      v: 30,
      patch: { fill: { value: { set: accent }, alpha: { set: 50 } }, text: { lineSpacing: { set: 120 } } },
    }
    expect(converted(row, stampOf, conversions, undefined)).toEqual({
      v: 50,
      patch: { fill: { alpha: { set: 50 }, paints: { set: [accent] } }, text: { lineHeight: { set: 120 } } },
    })
  })

  it("runs only the conversions newer than the row's own stamp", () => {
    const row = { v: 45, patch: { fill: { value: { set: accent } }, text: { lineSpacing: { set: 120 } } } }
    expect(converted(row, stampOf, conversions, undefined)).toEqual({
      v: 50,
      patch: { fill: { value: { set: accent } }, text: { lineHeight: { set: 120 } } },
    })
  })

  it("hands back a row already in today's shape as the same value", () => {
    const today = { v: 50, patch: { fill: { paints: "opening" } } }
    expect(converted(today, stampOf, conversions, undefined)).toBe(today)
    const unstamped = { patch: { fill: { paints: "inherit" } } }
    expect(converted(unstamped, stampOf, conversions, undefined)).toBe(unstamped)
  })

  it("refuses a value a conversion cannot carry", () => {
    expect(
      converted({ v: 30, patch: { fill: { value: { solid: accent } } } }, stampOf, conversions, undefined),
    ).toBeNull()
  })
})
