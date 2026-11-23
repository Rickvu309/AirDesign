import { describe, expect, it } from "vitest"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"
import { readTraits } from "./trait-read.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function text(parts: Parts, part: string): string {
  return decodeUtf8(parts.get(part)!)
}

function withPart(parts: Parts, part: string, edit: (text: string) => string): Parts {
  const next = new Map(parts)
  next.set(part, encodeUtf8(edit(text(parts, part))))
  return next
}

describe("exportParts on effects", () => {
  it("reads an own effect DAG as kept, so a patch inside it is refused", async () => {
    const original = await deck("clean.pptx")
    const read = readSlides(original)[0]!
    const parts = withPart(original, read.part, (xml) =>
      xml.replace(
        /<p:spPr>(.*?)<\/p:spPr>/s,
        '<p:spPr>$1<a:effectDag type="sib"><a:glow rad="1"/></a:effectDag></p:spPr>',
      ),
    )
    const shape = indexPackage(parts).elements.find(
      (each) => each.node.startsWith(`${read.slide}.`) && each.kind === "shape",
    )
    expect(readTraits(parts).elements.get(shape!.node)?.kept).toEqual(
      expect.arrayContaining(["effects.shadow", "effects.glow", "effects.softEdge"]),
    )
  })
})
