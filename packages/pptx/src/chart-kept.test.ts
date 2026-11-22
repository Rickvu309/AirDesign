import { decide, elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readShapes, shapeKind } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const decks = ["census-updating-spm.pptx", "office-chart.pptx"]

async function deckParts(name: string) {
  return readParts(new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

async function chartFrames(name: string) {
  const parts = await deckParts(name)
  const frames = readShapes(parts).filter(
    (shape) =>
      shape.kind === "p:graphicFrame" && decodeUtf8(parts.get(shape.part) ?? new Uint8Array()).includes("<c:chart "),
  )
  return { parts, frames }
}

describe("a PowerPoint chart frame", () => {
  it("opens as kept content, in every chart deck", async () => {
    for (const name of decks) {
      const { parts, frames } = await chartFrames(name)
      expect(frames.length, name).toBeGreaterThan(0)
      expect(frames.map((shape) => shapeKind(shape))).toEqual(frames.map(() => "kept"))
      const index = indexPackage(parts)
      for (const frame of frames) {
        const element = index.elements.find((each) => each.node === elementId(`${frame.slide}.${frame.shape}`))
        expect(element, name).toMatchObject({ kind: "kept", value: null })
      }
      expect(index.elements.map((each) => each.kind as string)).not.toContain("chart")
    }
  })

  it("exports byte for byte when nothing about it was edited", async () => {
    for (const name of decks) {
      const { parts, frames } = await chartFrames(name)
      const [frame] = frames
      if (frame === undefined) throw new Error(name)
      const node = elementId(`${frame.slide}.${frame.shape}`)
      const register = landed(openRegister("", "clean"), [{ command: "add", node, floor: "", route: "clean" }])
      const exported = exportParts(parts, register)
      expect(exported.get(frame.part), name).toBe(parts.get(frame.part))
      for (const [part, bytes] of parts) expect(exported.get(part), `${name} ${part}`).toBe(bytes)
    }
  })
})
