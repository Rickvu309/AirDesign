import { describe, expect, it } from "vitest"
import {
  alphaOver,
  angle,
  choice,
  color,
  count,
  custom,
  emu,
  flag,
  fraction,
  list,
  mark,
  named,
  readValue,
  record,
  size,
  typeSize,
  union,
  words,
} from "./value-kind.js"

describe("the one stored reader walks a field's value kind", () => {
  it("reads whole numbers inside a number kind's range", () => {
    expect(readValue(emu, -12)).toBe(-12)
    expect(readValue(emu, -0)).toBe(0)
    expect(readValue(size, -1)).toBeNull()
    expect(readValue(size, 1.5)).toBeNull()
    expect(readValue(size, "12")).toBeNull()
    expect(readValue(angle, 21_600_000)).toBeNull()
    expect(readValue(fraction, 100_000)).toBe(100_000)
    expect(readValue(typeSize, 99)).toBeNull()
    expect(readValue(count(1, 16), 16)).toBe(16)
    expect(readValue(alphaOver("value"), 60_000)).toBe(60_000)
    expect(readValue(alphaOver("value"), 100_001)).toBeNull()
  })

  it("reads flags, words, choices and marks", () => {
    expect(readValue(flag, false)).toBe(false)
    expect(readValue(flag, 0)).toBeNull()
    expect(readValue(words(3), "abc")).toBe("abc")
    expect(readValue(words(3), "abé")).toBeNull()
    expect(readValue(choice(["sm", "med", "lg"]), "med")).toBe("med")
    expect(readValue(choice(["sm", "med", "lg"]), "xl")).toBeNull()
    expect(readValue(mark, true)).toBe(true)
    expect(readValue(mark, false)).toBeNull()
  })

  it("reads a colour as the one colour reader does", () => {
    expect(readValue(color, { scheme: "accent1", transforms: [{ op: "lumMod", val: 75_000 }] })).toEqual({
      scheme: "accent1",
      transforms: [{ op: "lumMod", val: 75_000 }],
    })
    expect(readValue(color, { scheme: "accent9" })).toBeNull()
    expect(readValue(color, undefined)).toBeNull()
  })

  it("reads a record only with every field and no other key", () => {
    const inset = record({ l: size, r: size })
    expect(readValue(inset, { l: 1, r: 2 })).toEqual({ l: 1, r: 2 })
    expect(readValue(inset, { l: 1 })).toBeNull()
    expect(readValue(inset, { l: 1, r: 2, t: 3 })).toBeNull()
    expect(readValue(inset, [1, 2])).toBeNull()
  })

  it("reads a union as one case and its value", () => {
    const join = union({ round: mark, miter: fraction })
    expect(readValue(join, { round: true })).toEqual({ round: true })
    expect(readValue(join, { miter: 80_000 })).toEqual({ miter: 80_000 })
    expect(readValue(join, { round: true, miter: 1 })).toBeNull()
    expect(readValue(join, { bevel: true })).toBeNull()
    expect(readValue(join, "round")).toBeNull()
  })

  it("reads a list inside its length and a named map inside its size", () => {
    const stops = list(fraction, 2, 3)
    expect(readValue(stops, [0, 100_000])).toEqual([0, 100_000])
    expect(readValue(stops, [0])).toBeNull()
    expect(readValue(stops, [0, 1, 2, 3])).toBeNull()
    expect(readValue(stops, [0, -1])).toBeNull()
    const adjust = named(count(-10, 10), 2)
    expect(readValue(adjust, { adj: 5 })).toEqual({ adj: 5 })
    expect(readValue(adjust, { a: 1, b: 2, c: 3 })).toBeNull()
    expect(readValue(adjust, { adj: 11 })).toBeNull()
  })

  it("reads stored text and tables as the strings format 1 stores, and a node as an element id", () => {
    expect(readValue(custom<string, string>("text"), '[{"from":0,"runs":[]}]')).toBe('[{"from":0,"runs":[]}]')
    expect(readValue(custom<string, string>("table"), 7)).toBeNull()
    expect(readValue(custom<string, string>("asset"), "a".repeat(64))).toBe("a".repeat(64))
    expect(readValue(custom<string, string>("node"), "256.7")).toBe("256.7")
    expect(readValue(custom<string, string>("node"), "256")).toBeNull()
  })
})
