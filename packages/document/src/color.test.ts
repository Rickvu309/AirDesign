import { describe, expect, it } from "vitest"
import { readColor, sameColor, writtenColor, type Color } from "./color.js"

const stored = (color: Color): unknown => JSON.parse(JSON.stringify(writtenColor(color)))

describe("readColor", () => {
  it.each<Color>([
    { scheme: "accent1" },
    { scheme: "folHlink" },
    { scheme: "tx2" },
    { rgb: "1F4E79" },
    { system: "windowText", last: "000000" },
    { system: "3dDkShadow", last: "696969" },
    { preset: "dkSlateBlue" },
  ])("reads the base it wrote: %j", (color) => {
    expect(readColor(stored(color))).toEqual(color)
  })

  it.each<Color>([
    { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] },
    {
      scheme: "bg1",
      transforms: [
        { op: "lumMod", val: 50000 },
        { op: "lumOff", val: 50000 },
      ],
    },
    { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }] },
    {
      rgb: "000000",
      transforms: [
        { op: "alphaMod", val: 250000 },
        { op: "alphaOff", val: -20000 },
      ],
    },
    {
      scheme: "accent2",
      transforms: [
        { op: "tint", val: 40000 },
        { op: "shade", val: 0 },
      ],
    },
    {
      scheme: "accent3",
      transforms: [
        { op: "hue", val: 21599999 },
        { op: "hueOff", val: -5400000 },
      ],
    },
    {
      scheme: "accent4",
      transforms: [
        { op: "hueMod", val: 0 },
        { op: "sat", val: 0 },
        { op: "satMod", val: 120000 },
      ],
    },
    {
      scheme: "accent5",
      transforms: [
        { op: "satOff", val: -10000 },
        { op: "lum", val: 100000 },
      ],
    },
    {
      rgb: "336699",
      transforms: [
        { op: "red", val: 1 },
        { op: "redMod", val: 2 },
        { op: "redOff", val: -3 },
      ],
    },
    {
      rgb: "336699",
      transforms: [
        { op: "green", val: 4 },
        { op: "greenMod", val: 5 },
        { op: "greenOff", val: 6 },
      ],
    },
    {
      rgb: "336699",
      transforms: [
        { op: "blue", val: 7 },
        { op: "blueMod", val: 8 },
        { op: "blueOff", val: -9 },
      ],
    },
    { preset: "red", transforms: [{ op: "comp" }, { op: "inv" }, { op: "gray" }, { op: "gamma" }, { op: "invGamma" }] },
    { system: "window", last: "FFFFFF", transforms: [{ op: "shade", val: 95000 }] },
  ])("keeps every transform in order: %j", (color) => {
    expect(readColor(stored(color))).toEqual(color)
  })

  it("writes a colour with no transforms as the run colour JSON stored today", () => {
    expect(JSON.stringify(writtenColor({ scheme: "accent2" }))).toBe('{"scheme":"accent2"}')
    expect(JSON.stringify(writtenColor({ rgb: "0F2433" }))).toBe('{"rgb":"0F2433"}')
  })

  it("writes the base before its transforms whatever order the keys came in", () => {
    const color = readColor({ transforms: [{ val: 75000, op: "lumMod" }], scheme: "accent1" })
    expect(color === null || color === undefined ? null : JSON.stringify(writtenColor(color))).toBe(
      '{"scheme":"accent1","transforms":[{"op":"lumMod","val":75000}]}',
    )
  })

  it("reads no colour from undefined", () => {
    expect(readColor(undefined)).toBeUndefined()
  })

  it.each<unknown>([
    null,
    "accent1",
    {},
    { scheme: "phClr" },
    { scheme: "accent7" },
    { rgb: "1f4e79" },
    { rgb: "FFF" },
    { rgb: '000000"/><a:noFill/>' },
    { scheme: "accent1", rgb: "000000" },
    { scheme: "accent1", extra: true },
    { system: "windowText" },
    { system: "desktop", last: "000000" },
    { system: "windowText", last: "black" },
    { preset: "" },
    { preset: 'red"/>' },
    { scheme: "accent1", transforms: [] },
    { scheme: "accent1", transforms: {} },
    { scheme: "accent1", transforms: [{ op: "lumMod" }] },
    { scheme: "accent1", transforms: [{ op: "lumMod", val: 1.5 }] },
    { scheme: "accent1", transforms: [{ op: "lumMod", val: "75000" }] },
    { scheme: "accent1", transforms: [{ op: "comp", val: 1 }] },
    { scheme: "accent1", transforms: [{ op: "lighten", val: 1 }] },
    { scheme: "accent1", transforms: [{ op: "alpha", val: 100001 }] },
    { scheme: "accent1", transforms: [{ op: "tint", val: -1 }] },
    { scheme: "accent1", transforms: [{ op: "alphaOff", val: 100001 }] },
    { scheme: "accent1", transforms: [{ op: "alphaMod", val: -1 }] },
    { scheme: "accent1", transforms: [{ op: "hue", val: 21600000 }] },
    { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000, extra: 1 }] },
  ])("refuses %j", (value) => {
    expect(readColor(value)).toBeNull()
  })
})

describe("sameColor", () => {
  it("compares the base and every transform in order", () => {
    const darker: Color = { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] }
    expect(sameColor(darker, { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] })).toBe(true)
    expect(sameColor(darker, { scheme: "accent1" })).toBe(false)
    expect(sameColor({ scheme: "accent1" }, { scheme: "accent1" })).toBe(true)
    expect(sameColor({ rgb: "000000" }, { scheme: "dk1" })).toBe(false)
    expect(
      sameColor(
        { rgb: "000000", transforms: [{ op: "alpha", val: 1 }, { op: "gray" }] },
        { rgb: "000000", transforms: [{ op: "gray" }, { op: "alpha", val: 1 }] },
      ),
    ).toBe(false)
    expect(sameColor(null, null)).toBe(true)
    expect(sameColor(undefined, null)).toBe(true)
    expect(sameColor({ rgb: "000000" }, null)).toBe(false)
  })
})
