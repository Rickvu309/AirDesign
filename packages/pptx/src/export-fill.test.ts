import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Command,
  type ElementPatch,
  type FieldValue,
  type Register,
} from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { shownFill } from "./fill-read.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { sameBytes } from "./package-bytes.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>
type Fill = FieldValue<"fills", "p0">

const red: Fill = { solid: { rgb: "C00000" } }
const navy: Fill = { solid: { rgb: "1F4E79" } }
const node = elementId("256.2")
const clone = elementId("257.2")
const part = "ppt/slides/slide1.xml"

async function clean(): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`)))
}

function indexed(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "clean"), index: { ...index, total: index.elements.length, pages: [] } }
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

function filled(at: typeof node, patch: ElementPatch): readonly Command[] {
  return [
    { command: "add", node: at, floor: "", route: "clean" },
    { command: "person", node: at, v: format, patch },
  ]
}

function exported(parts: Parts, register: Register): Parts {
  return exportParts(orderedParts(parts, register), register)
}

describe("exportParts on a filled shape", () => {
  it("writes a person's fill row, goes back to the inherited fill, and gives the file again at opening", async () => {
    const parts = await clean()
    const set = exported(parts, landed(indexed(parts), filled(node, { fills: { p0: { set: red } } })))
    expect(shownFill(set, { part, shape: "2" })).toEqual({ value: red, own: true })
    const reset = exported(parts, landed(indexed(parts), filled(node, { fills: { p0: "inherit" } })))
    expect(shownFill(reset, { part, shape: "2" })?.own).toBe(false)
    const back = exported(parts, landed(indexed(parts), filled(node, { fills: { p0: "opening" } })))
    expect(sameBytes(back.get(part)!, parts.get(part)!)).toBe(true)
  })

  it("gives a cloned slide the fill its floor carries, and keeps it when a row on the clone says opening", async () => {
    const parts = await clean()
    const element = indexPackage(parts).elements.find((each) => each.node === node)
    if (element === undefined) throw new Error("element")
    const key = orderKeyBetween(null, null)
    const floor = [{ ...element, node: clone, opening: { fills: { p0: { set: navy } } } }]
    const file = [slideId("256")]
    const cloned = landed(indexed(parts), [
      { command: "slide", file, edit: { slide: "clone", id: slideId("257"), source: file[0]!, key, floor } },
    ])
    const at = (register: Register) => {
      const out = exported(parts, register)
      const slide = [...out.keys()].find((name) => name !== part && /^ppt\/slides\/slide\d+\.xml$/.test(name))
      return slide === undefined ? null : shownFill(out, { part: slide, shape: "2" })?.value
    }
    expect(at(cloned)).toEqual(navy)
    expect(at(landed(cloned, filled(clone, { fills: { p0: "opening" } })))).toEqual(navy)
    expect(at(landed(cloned, filled(clone, { fills: { p0: { set: red } } })))).toEqual(red)
    expect(shownFill(exported(parts, cloned), { part, shape: "2" })?.value).toEqual({ solid: { scheme: "accent1" } })
  })
})
