import { describe, expect, it } from "vitest"
import { answeredRegister } from "./answered-register.js"
import { readIndexPage } from "./deck-index.js"
import type { Register } from "./decide.js"
import { format } from "./format.js"
import written from "./format-57-pictures.json" with { type: "json" }
import { readSlideState } from "./slide-order.js"
import { readRegister, readRow } from "./stored.js"

const imageFormat = 63
const borderFormat = 64

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

const none = { set: { none: true } }

describe("a deck the first fills build saved, with a photo, an icon and an icon fill", () => {
  it("reads the photo's crop, recolor, blur, overlay and opacity rows as fields of its fills", () => {
    expect(patches(readDeck(), "256.4")).toEqual([
      { v: imageFormat, patch: { fills: { crop: { set: { l: 10_000, t: 0, r: 10_000, b: 0 } } } } },
      { v: imageFormat, patch: { fills: { recolor: { set: { grayscale: true } } } } },
      {
        v: imageFormat,
        patch: {
          fills: {
            blur: { set: 20_000 },
            overlay: { set: { solid: { rgb: "000000", transforms: [{ op: "alpha", val: 50_000 }] } } },
          },
        },
      },
      { v: borderFormat, patch: { border: { alpha: { set: 70_000 } }, fills: { alpha: { set: 70_000 } } } },
    ])
  })

  it("reads a shape's icon fill as an image paint with its source, and its fit as the fills' mode", () => {
    expect(patches(readDeck(), "256.2")).toEqual([
      {
        v: imageFormat,
        patch: { fills: { p0: { set: { image: true } }, p1: none, p2: none, p3: none, source: { set: "star" } } },
      },
      { v: imageFormat, patch: { fills: { mode: { set: "fit" } } } },
    ])
  })

  it("reads the added icon as a shape whose fills hold it, and the photo in the index as a shape", () => {
    const register = readDeck()
    const added = register.order.find((command) => command.slide === "element-add")
    expect(added?.slide === "element-add" ? added.element : undefined).toMatchObject({
      node: "256.5",
      kind: "shape",
      value: null,
      opening: { fills: { p0: { set: { image: true } }, source: { set: "rocket" } } },
    })
    expect(register.index?.elements.find((element) => element.node === "256.4")?.kind).toBe("shape")
    const traits = Object.values(register.elements).flatMap((body) =>
      body.landed.flatMap((row) => (row.v === undefined ? [] : Object.keys(row.patch))),
    )
    expect(traits.filter((trait) => trait === "image" || trait === "crop")).toEqual([])
    expect(JSON.stringify(register)).not.toContain('"kind":"picture"')
    expect(answeredRegister(register).format).toBe(format)
  })

  it("reads the rows the device kept, the one left unsent included, as fills", () => {
    const rows = written.device.rows.map((row) => {
      const read = readRow(row, "text")
      if (!read.ok) throw new Error(read.refusal)
      return read.value
    })
    expect(rows.flatMap((row) => Object.keys(row.patch))).not.toContain("image")
    expect(rows.flatMap((row) => Object.keys(row.patch))).not.toContain("crop")
    expect(rows.at(-1)).toEqual({ v: imageFormat, patch: { fills: { mode: { set: "tile" } } } })
  })

  it("reads an index page whose cropped picture has a fill behind it, and an icon add the device kept", () => {
    const page = readIndexPage(written.page)
    const oval = page?.elements.find((element) => element.node === "290.6")
    expect(oval).toMatchObject({
      kind: "shape",
      design: {
        geometry: ["ellipse"],
        fills: ["bg2"],
        "fills.crop": ["l 0 t 0 r 0 b 0"],
        "identity.alt": ["cityscape"],
      },
    })
    const added = written.register.order.find((command) => command.slide === "element-add")
    const state = readSlideState({ file: written.register.file, order: [added] })
    const [command] = state?.order ?? []
    expect(command?.slide === "element-add" ? command.element.kind : undefined).toBe("shape")
  })
})
