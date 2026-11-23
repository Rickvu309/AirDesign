import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
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
})
