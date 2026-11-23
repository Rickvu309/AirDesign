import { coordinates, type Desc } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readAgent } from "./agent-form.js"

const navy = "1F4E79"

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

  it("reads a colour as Doom stores it, a hex in lower case or a theme colour with its tint", () => {
    const color: Desc = { kind: "color" }
    expect(read(color, `#${navy}`)).toEqual({ ok: true, value: `#${navy.toLowerCase()}` })
    expect(read(color, { var: "accent1" })).toEqual({ ok: true, value: { var: "accent1" } })
    expect(read(color, { var: "text2", tint: -0.25 })).toEqual({ ok: true, value: { var: "text2", tint: -0.25 } })
    for (const wrong of [
      "accent1",
      "tx1 lumMod 75",
      { scheme: "accent1" },
      { rgb: navy },
      `#${navy} alpha 35.5`,
      "",
      7,
    ])
      expect(read(color, wrong), JSON.stringify(wrong)).toEqual({ ok: false })
  })

  it("reads a bare hex as six upper-case digits", () => {
    const hex: Desc = { kind: "hex" }
    expect(read(hex, `#${navy.toLowerCase()}`)).toEqual({ ok: true, value: navy })
    for (const wrong of [navy, `#${navy}0`, { var: "accent1" }]) expect(read(hex, wrong)).toEqual({ ok: false })
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
