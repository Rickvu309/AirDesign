declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Command,
  type ElementId,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { readParts } from "./package-container.js"
import { readShapes } from "./read-shapes.js"
import { orderedParts } from "./slide-order-route.js"
import { writtenDeck } from "./written-deck.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const id = slideId("256")
const box = { x: 0, y: 0, cx: 1000000, cy: 500000 }

async function clean() {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`))
}

function shape(node: ElementId): SlideCommand {
  return {
    slide: "element-add",
    id,
    element: { node, kind: "shape", value: null, box, grouped: false },
    geometry: "rect",
  }
}

function boxless(node: ElementId): SlideCommand {
  return {
    slide: "element-add",
    id,
    element: { node, kind: "shape", value: null, box: null, grouped: false },
    geometry: "rect",
  }
}

function shapesOn(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  return readShapes(parts).map((each) => each.shape)
}

function moved(register: Register, node: ElementId): Register {
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "" },
    { command: "person", v: format, patch: { box: { x: { set: 500000 } } }, node },
  ]
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

describe("an edit this device cannot write into the file is left out on its own", () => {
  it("writes the edits before and after it and names the one it left out", async () => {
    const parts = await clean()
    const unwritable = boxless(elementId("256.10"))
    const register = {
      ...openRegister("", ""),
      file: [id],
      order: [shape(elementId("256.9")), unwritable, shape(elementId("256.11"))],
    }
    expect(() => orderedParts(parts, register)).toThrow("box")
    const written = writtenDeck(parts, register)
    expect(shapesOn(written.parts)).toEqual(expect.arrayContaining(["9", "11"]))
    expect(shapesOn(written.parts)).not.toContain("10")
    expect(written.leftOut).toEqual([unwritable])
  })

  it("leaves out the rows of a layer only the left-out edit made, so the export writes the rest", async () => {
    const parts = await clean()
    const made = elementId("256.10")
    const kept = elementId("256.9")
    const opened = { ...openRegister("", ""), file: [id], order: [shape(kept), boxless(made)] }
    const register = moved(moved(opened, made), kept)
    const written = writtenDeck(parts, register)
    expect(() => exportParts(written.parts, register)).toThrow("box-shape")
    const exported = exportParts(written.parts, written.register)
    expect(readShapes(exported).find((each) => each.shape === "9")?.box?.x).toBe(500000)
    expect(written.register.nodes).toContain(kept)
    expect(written.register.nodes).not.toContain(made)
  })

  it("hands back the same parts and register when every edit writes", async () => {
    const parts = await clean()
    const register = { ...openRegister("", ""), file: [id], order: [shape(elementId("256.9"))] }
    const written = writtenDeck(parts, register)
    expect(written.register).toBe(register)
    expect(written.leftOut).toEqual([])
    expect(shapesOn(written.parts)).toContain("9")
  })
})
