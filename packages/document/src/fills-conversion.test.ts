import { describe, expect, it } from "vitest"
import { answeredRegister } from "./answered-register.js"
import { readIndexPage, type IndexElement } from "./deck-index.js"
import type { Register } from "./decide.js"
import { format } from "./format.js"
import written from "./format-53-deck.json" with { type: "json" }
import { record } from "./plain-object.js"
import { readSlideState } from "./slide-order.js"
import { readRegister, readRow } from "./stored.js"

const fillsFormat = 57

function readDeck(): Register {
  const read = readRegister(written.register)
  if (!read.ok) throw new Error(read.refusal)
  return read.value
}

function patches(register: Register, node: string): readonly unknown[] {
  return (register.elements[node as keyof Register["elements"]]?.landed ?? []).map((row) =>
    row.v === undefined ? row : { v: row.v, patch: row.patch },
  )
}

function floorOf(register: Register, slide: string): readonly IndexElement[] {
  const clone = register.order.find((command) => command.slide === "clone" && command.id === slide)
  return clone?.slide === "clone" ? (clone.floor ?? []) : []
}

describe("a deck a format 53 build saved", () => {
  it("reads every fill row as fills, stamped with the format that first wrote fills", () => {
    const register = readDeck()
    expect(patches(register, "382.3")).toEqual([{ v: fillsFormat, patch: { fills: { p0: "inherit" } } }])
    expect(patches(register, "382.5")).toEqual([
      {
        v: fillsFormat,
        patch: {
          fills: { alpha: { set: 40_000 } },
          line: { alpha: { set: 40_000 } },
          text: { alpha: { set: 40_000 } },
        },
      },
    ])
    expect(patches(register, "447.4")[0]).toEqual({
      v: fillsFormat,
      patch: { fills: { p0: { set: { image: "rocket" } } } },
    })
    expect(patches(register, "452.slide")).toEqual([
      { v: fillsFormat, patch: { fills: { p0: { set: { solid: { rgb: "1F4E79" } } } } } },
    ])
    const traits = Object.values(register.elements).flatMap((body) =>
      body.landed.flatMap((row) => (row.v === undefined ? [] : Object.keys(row.patch))),
    )
    expect(traits).not.toContain("fill")
    expect(traits.filter((trait) => trait === "fills").length).toBe(20)
  })

  it("reads the duplicated slide's floor with its fills openings", () => {
    const floor = floorOf(readDeck(), "471")
    expect(floor.find((element) => element.node === "471.5")?.opening).toEqual({
      fills: { p0: { set: { solid: { scheme: "accent2" } } } },
    })
    expect(floor.flatMap((element) => Object.keys(element.opening ?? {}))).not.toContain("fill")
    expect(floor.flatMap((element) => Object.keys(element.design ?? {}))).not.toContain("fill")
  })

  it("reads the index's design summaries and pictures' fills under fills", () => {
    const index = readDeck().index
    const elements = index?.elements ?? []
    expect(elements.length).toBe(written.register.index.elements.length)
    const picture = written.register.index.elements.find((element) => element.node === "460.1026")
    expect(elements.find((element) => element.node === "460.1026")?.design).toEqual({ fills: picture?.design?.fill })
    expect(elements.flatMap((element) => Object.keys(element.design ?? {}))).not.toContain("fill")
    expect(index?.format).toBe(written.register.index.format)
  })

  it("answers an older tab that this deck is newer than it", () => {
    expect(answeredRegister(readDeck()).format).toBe(format)
  })
})

describe("what a format 53 device kept", () => {
  it("reads its confirmed and pending fill rows as fills", () => {
    const rows = written.device.rows.flatMap((row) => {
      if (!("patch" in row)) return []
      const read = readRow(row, "text")
      if (!read.ok) throw new Error(read.refusal)
      return [read.value]
    })
    expect(rows.map((row) => Object.keys(row.patch))).toEqual([
      ["fills"],
      ["fills", "line", "text"],
      ["fills"],
      ["fills"],
      ["fills"],
      ["fills"],
      ["fills"],
    ])
    expect(rows.at(-1)).toEqual({
      v: fillsFormat,
      patch: {
        fills: { p0: { set: { pattern: { preset: "pct5", fg: { scheme: "accent1" }, bg: { scheme: "accent1" } } } } },
      },
    })
  })

  it("reads its confirmed slide duplicate with fills openings", () => {
    const row = written.device.rows.find((each) => "slideEdit" in each)
    const held = record(row)
    const state = readSlideState({ file: held?.slideFile, order: [held?.slideEdit] })
    const [clone] = state?.order ?? []
    const floor = clone?.slide === "clone" ? (clone.floor ?? []) : []
    expect(floor.find((element) => element.node === "471.5")?.opening).toEqual({
      fills: { p0: { set: { solid: { scheme: "accent2" } } } },
    })
  })

  it("reads its cached index page, and a page whose picture fill is kept, under fills", () => {
    const page = readIndexPage(written.device.indexPage)
    expect(page?.format).toBe(53)
    expect(page?.elements.flatMap((element) => Object.keys(element.design ?? {}))).not.toContain("fill")
    const kept = readIndexPage(written.keptPage)?.elements.find((element) => element.kept?.includes("fills"))
    expect(kept?.kept).toEqual(["fills"])
    expect(kept?.design?.fills).toEqual(["image"])
  })
})
