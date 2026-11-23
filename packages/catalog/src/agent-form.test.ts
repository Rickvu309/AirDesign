import {
  bareTransforms,
  coordinates,
  mappedSlots,
  templateColors,
  valuedTransforms,
  type Desc,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { colorPattern, readAgentColor } from "./agent-color.js"
import { readAgent } from "./agent-form.js"

const navy = "1F4E79"
const black = "000000"

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

  it("reads a mark case by its name, the plain case bare, and any other case as its one key", () => {
    expect(read(join, "round")).toEqual({ ok: true, value: { round: true } })
    expect(read(dash, "dash")).toEqual({ ok: true, value: { preset: "dash" } })
    expect(read(dash, "none")).toEqual({ ok: true, value: { none: true } })
    for (const wrong of ["rounded", { round: true }, { miter: 80, bevel: true }, 80]) {
      expect(read(join, wrong), JSON.stringify(wrong)).toEqual({ ok: false })
    }
  })
})
