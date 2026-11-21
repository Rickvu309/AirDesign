declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import {
  decide,
  elementId,
  format,
  openRegister,
  writeTextValue,
  type Command,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { keptExport } from "./kept-export.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { readShapes } from "./read-shapes.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const node = elementId("256.2")

async function clean() {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`))
}

function landed(commands: readonly Command[]): Register {
  return commands.reduce(
    (current, command) => {
      const decision = decide(current, command)
      if (decision.decision === "refuse") throw new Error(decision.code)
      return decision.register
    },
    openRegister("", ""),
  )
}

const typed = (text: string, from = 0) => writeTextValue([{ from, runs: [{ from: 0, text }] }])

const edited = landed([
  { command: "add", node, floor: "", route: "" },
  { command: "person", value: typed("First"), node },
  { command: "person", value: typed("Nowhere", 9), node },
  { command: "person", v: format, patch: { box: { x: { set: 500000 } } }, node },
])

function slideText(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get("ppt/slides/slide1.xml") ?? new Uint8Array())
}

describe("an edit this device cannot write into a layer is left out on its own", () => {
  it("writes the layer's edits before and after it and names the one it left out", async () => {
    const parts = await clean()
    expect(() => exportParts(parts, edited)).toThrow("text-paragraph")
    const kept = keptExport(parts, edited)
    expect(slideText(kept.parts)).toContain("<a:t>First</a:t>")
    expect(readShapes(kept.parts).find((each) => each.shape === "2")?.box?.x).toBe(500000)
    expect(kept.leftOut).toEqual([{ node, row: 1 }])
    expect(keptExport(parts, edited).leftOut).toEqual([{ node, row: 1 }])
  })

  it("leaves out a whole layer whose stored state cannot be read", async () => {
    const parts = await clean()
    const broken = { ...edited, elements: { ...edited.elements, [node]: null } } as unknown as Register
    const kept = keptExport(parts, broken)
    expect(kept.parts.get("ppt/slides/slide1.xml")).toBe(parts.get("ppt/slides/slide1.xml"))
    expect(kept.leftOut).toEqual([{ node, row: null }])
  })

  it("hands back the export and nothing left out when every edit writes", async () => {
    const parts = await clean()
    const fine = landed([
      { command: "add", node, floor: "", route: "" },
      { command: "person", value: typed("First"), node },
    ])
    const kept = keptExport(parts, fine)
    expect(kept.leftOut).toEqual([])
    expect(slideText(kept.parts)).toBe(slideText(exportParts(parts, fine)))
  })
})
