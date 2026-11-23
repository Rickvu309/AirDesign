import {
  bareTransforms,
  coordinates,
  designBytes,
  mappedSlots,
  readDesign,
  shadowSlotKeys,
  templateColors,
  valuedTransforms,
  type Desc,
  type ElementRead,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import * as z from "zod/v4"
import { agentColor, colorPattern, readAgentColor } from "./agent-color.js"
import { agentSchema, designOf, flat, readAgent } from "./agent-form.js"

const navy = "1F4E79"
const black = "000000"
const white = "FFFFFF"

it("spells every template color and transform once in a compact colour pattern, and nothing else", () => {
  const exact = new RegExp(`^${colorPattern}$`)
  const slots = [...templateColors, ...mappedSlots]
  for (const slot of slots) expect(exact.test(slot), slot).toBe(true)
  for (const op of valuedTransforms) expect(exact.test(`accent1 ${op} 50`), op).toBe(true)
  for (const op of bareTransforms) expect(exact.test(`#${navy} ${op}`), op).toBe(true)
  for (const wrong of ["accent7", "dk3", "accent1 lumAdd 5", "accent1 tintMod 5", "accent1 comp 5", "hlink1", "bg"])
    expect(exact.test(wrong), wrong).toBe(false)
  expect(colorPattern.length).toBeLessThan(220)
})

it("writes a colour as an agent sends one: a template color or hex, then each transform in percent", () => {
  expect(agentColor({ scheme: "accent1" })).toBe("accent1")
  expect(agentColor({ rgb: navy })).toBe(`#${navy}`)
  expect(
    agentColor({
      scheme: "tx1",
      transforms: [
        { op: "lumMod", val: 75_000 },
        { op: "lumOff", val: 25_000 },
      ],
    }),
  ).toBe("tx1 lumMod 75 lumOff 25")
  expect(agentColor({ rgb: black, transforms: [{ op: "alpha", val: 35_500 }] })).toBe(`#${black} alpha 35.5`)
  expect(agentColor({ system: "windowText", last: black })).toBe(`#${black}`)
  expect(agentColor({ preset: "black", transforms: [{ op: "inv" }] })).toBe("black inv")
})

it("turns an element's read into its role, a design in agent units with each source, and the fields it keeps", () => {
  const read: ElementRead = {
    role: "title",
    reads: {
      fills: { value: { color: { scheme: "accent1" } }, source: "style" },
      "border.width": { value: 12_700, source: "style" },
      "border.fill": {
        value: { color: { scheme: "accent1", transforms: [{ op: "shade", val: 50_000 }] } },
        source: "style",
      },
      "effects.shadow": {
        value: {
          blur: 50_800,
          distance: 38_100,
          direction: 5_400_000,
          color: { rgb: black, transforms: [{ op: "alpha", val: 35_000 }] },
        },
        source: "style",
      },
      "text.size": { value: 3_600, source: "master" },
      "text.color": { value: { scheme: "tx1" }, source: "master" },
      "text.bold": { value: true },
      "body.anchor": { value: "b", source: "layout" },
      "box.rot": { value: 2_700_000 },
      geometry: { value: "roundRect" },
    },
    kept: ["geometry"],
  }
  expect(designOf(read)).toEqual({
    role: "title",
    design: {
      geometry: ["roundRect"],
      fills: ["accent1", "style"],
      "border.width": [1, "style"],
      "border.fill": ["accent1 shade 50", "style"],
      "effects.shadow": [`blur 4 distance 3 direction 90 #${black} alpha 35`, "style"],
      "text.size": [36, "master"],
      "text.color": ["tx1", "master"],
      "text.bold": [true],
      "body.anchor": ["b", "layout"],
      "box.rot": [45],
    },
    kept: ["geometry"],
  })
  expect(designOf({ reads: {}, kept: [] })).toEqual({})
  expect(
    designOf({ reads: { fills: { value: { gradient: [{ scheme: "accent1" }, { rgb: white }] } } }, kept: [] }).design,
  ).toEqual({ fills: [`gradient accent1, #${white}`] })
})

it("drops the last fields of a design that would not fit, so the index always takes it", () => {
  const long = { value: "A".repeat(150) }
  const read: ElementRead = {
    reads: { geometry: long, "border.dash": long, "border.head": long, "text.font": long },
    kept: [],
  }
  const { design } = designOf(read)
  expect(JSON.stringify(design).length).toBeLessThanOrEqual(designBytes)
  expect(Object.keys(design ?? {})).toEqual(["geometry", "border.dash"])
  expect(readDesign(design)).toEqual(design)
})

it("keeps an element's turn and flips when the rest of its design does not fit, so ungrouping maps it", () => {
  const long = { value: "A".repeat(150) }
  const reads = {
    geometry: long,
    "border.dash": long,
    "text.font": long,
    "box.rot": { value: 5_400_000 },
    "box.flipH": { value: true },
  }
  const { design } = designOf({ reads, kept: [] })
  expect(design?.["box.rot"]).toEqual([90])
  expect(design?.["box.flipH"]).toEqual([true])
  expect(JSON.stringify(design).length).toBeLessThanOrEqual(designBytes)
})

describe("the agent form reads what an agent sends into stored values, in agent units", () => {
  const read = (desc: Desc, raw: unknown) => readAgent(desc, raw)
  const emu: Desc = { kind: "number", unit: "emu", min: coordinates.lowest, max: coordinates.highest }
  const size: Desc = { kind: "number", unit: "emu", min: 0, max: coordinates.highest }
  const typeSize: Desc = { kind: "number", unit: "hundredth-point", min: 100, max: 400_000 }
  const join: Desc = {
    kind: "union",
    cases: {
      round: { kind: "mark" },
      bevel: { kind: "mark" },
      miter: { kind: "number", unit: "fraction", min: 0, max: 100_000 },
    },
    plain: null,
  }
  const dash: Desc = {
    kind: "union",
    cases: { preset: { kind: "choice", options: ["solid", "dash"] }, none: { kind: "mark" } },
    plain: "preset",
  }

  it("reads lengths in points, type sizes in points and fractions in percent", () => {
    expect(read(emu, 72)).toEqual({ ok: true, value: 914_400 })
    expect(read(emu, -36.5)).toEqual({ ok: true, value: -463_550 })
    expect(read(typeSize, 10.5)).toEqual({ ok: true, value: 1_050 })
    expect(read(join, { miter: 80 })).toEqual({ ok: true, value: { miter: 80_000 } })
  })

  it("bounds a length to the widest slide PowerPoint allows, so EMU sent as points fails", () => {
    expect(read(emu, 4_032)).toEqual({ ok: true, value: 51_206_400 })
    expect(read(emu, 914_400)).toEqual({ ok: false })
    expect(read(size, -1)).toEqual({ ok: false })
    expect(read(typeSize, 0.5)).toEqual({ ok: false })
    expect(read(emu, "72")).toEqual({ ok: false })
  })

  it("reads a colour as a template color or hex, then each transform in percent", () => {
    expect(readAgentColor("accent1")).toEqual({ scheme: "accent1" })
    expect(readAgentColor(`#${navy.toLowerCase()}`)).toEqual({ rgb: navy })
    expect(readAgentColor("tx1 lumMod 75 lumOff 25")).toEqual({
      scheme: "tx1",
      transforms: [
        { op: "lumMod", val: 75_000 },
        { op: "lumOff", val: 25_000 },
      ],
    })
    expect(readAgentColor(`#${black} alpha 35.5`)).toEqual({ rgb: black, transforms: [{ op: "alpha", val: 35_500 }] })
    expect(readAgentColor("accent2 inv")).toEqual({ scheme: "accent2", transforms: [{ op: "inv" }] })
    for (const wrong of ["accent9", "accent1 lumMod", "red", "#12345", "accent1 alpha 150", "", 7]) {
      expect(readAgentColor(wrong), String(wrong)).toBeNull()
    }
  })

  it("reads back every colour the agent form writes", () => {
    for (const color of [
      { scheme: "accent1" },
      { rgb: navy, transforms: [{ op: "alpha", val: 35_500 }] },
      { scheme: "bg2", transforms: [{ op: "lumMod", val: 75_000 }, { op: "gray" }] },
    ] as const) {
      expect(readAgentColor(agentColor(color))).toEqual(color)
    }
  })

  it("reads a mark case by its name, the plain case bare, and any other case as its one key", () => {
    expect(read(join, "round")).toEqual({ ok: true, value: { round: true } })
    expect(read(dash, "dash")).toEqual({ ok: true, value: { preset: "dash" } })
    expect(read(dash, "none")).toEqual({ ok: true, value: { none: true } })
    for (const wrong of ["rounded", { round: true }, { miter: 80, bevel: true }, 80]) {
      expect(read(join, wrong), JSON.stringify(wrong)).toEqual({ ok: false })
    }
  })

  it("derives one flat schema per kind that takes what the reader takes and refuses its typos", () => {
    for (const [desc, good, bad] of [
      [emu, [72, -36.5], [914_400, "72"]],
      [typeSize, [36], [0.5]],
      [{ kind: "color" }, ["accent1", `#${navy}`, "tx1 lumMod 75"], ["red", "accent1 lumMod"]],
      [join, ["round", { miter: 80 }], ["rounded", { round: true }]],
      [dash, ["dash", "none", { preset: "solid" }], ["dotted", 3]],
      [{ kind: "choice", options: ["left", "center"] }, ["left"], ["middle"]],
      [{ kind: "flag" }, [true], ["yes"]],
    ] as const satisfies readonly (readonly [Desc, readonly unknown[], readonly unknown[]])[]) {
      const schema = agentSchema(desc)
      expect(flat(schema), JSON.stringify(schema)).toBe(true)
      const check = z.fromJSONSchema(schema)
      for (const value of good) {
        expect(check.safeParse(value).success, JSON.stringify(value)).toBe(true)
        expect(read(desc, value).ok, JSON.stringify(value)).toBe(true)
      }
      for (const value of bad) {
        expect(check.safeParse(value).success, JSON.stringify(value)).toBe(false)
        expect(read(desc, value).ok, JSON.stringify(value)).toBe(false)
      }
    }
  })
})

it("indexes a full shadow stack alongside the usual design fields", () => {
  const shadow = {
    value: {
      blur: 50_800,
      distance: 38_100,
      direction: 2_700_000,
      color: { rgb: black, transforms: [{ op: "alpha", val: 35_000 }] },
    },
  } as const
  const indexed = designOf({
    kept: [],
    reads: {
      ...Object.fromEntries(shadowSlotKeys.map((slot) => [slot, shadow])),
      "effects.shadow": shadow,
      "effects.innerShadow": shadow,
      "box.rot": { value: 2_700_000 },
      fills: { value: { color: { rgb: navy } } },
    },
  }).design
  expect(readDesign(indexed)).toEqual(indexed)
  const keys = ["effects.shadow", "effects.innerShadow", ...shadowSlotKeys] as const
  for (const key of keys) expect(indexed?.[key]).toEqual([`blur 4 distance 3 direction 45 #${black} alpha 35`])
  expect(indexed?.["box.rot"]).toEqual([45])
  expect(indexed?.fills).toEqual([`#${navy}`])
})

describe("a text that shows a template font", () => {
  it("keeps the template font's place in the index rather than its name", () => {
    const read = (templateFont: "major" | "minor"): ElementRead => ({
      reads: { "text.font": { value: "Calibri", source: "master", templateFont } },
      kept: [],
    })
    expect(designOf(read("major")).design).toEqual({ "text.font": ["+mj-lt", "master"] })
    expect(designOf(read("minor")).design).toEqual({ "text.font": ["+mn-lt", "master"] })
    expect(designOf({ reads: { "text.font": { value: "Abadi" } }, kept: [] }).design).toEqual({
      "text.font": ["Abadi"],
    })
  })
})

describe("foldDesign shows an image's fill mode", () => {
  it("prints the mode a file holds in the opened design line", () => {
    const read = { reads: { fills: { value: "image" }, "fills.mode": { value: "fit" } }, kept: [] }
    expect(designOf(read as Parameters<typeof designOf>[0]).design).toEqual({ fills: ["image"], "fills.mode": ["fit"] })
  })
})
