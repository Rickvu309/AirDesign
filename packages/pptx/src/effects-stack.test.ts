import { expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { extensionDrops, effectsUri } from "./effects-extension.js"
import { shownEffects } from "./effects-read.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { readShapes, readSlides } from "./read-shapes.js"
import { writtenStandIn } from "./stand-in.js"
import { standRecords } from "./stand-read.js"
import { markupChildren } from "./text-value-route.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
  getBuiltinModule(name: "node:buffer"): { Buffer: { from(data: string, encoding: "base64"): Uint8Array } }
}

const outer = {
  blur: 50_800,
  distance: 38_100,
  direction: 2_700_000,
  color: { rgb: "000000", transforms: [{ op: "alpha", val: 40_000 }] },
} as const

const png = new Uint8Array(
  process
    .getBuiltinModule("node:buffer")
    .Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
)

async function deck(name: string) {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

it("keeps three drop shadows, exports the extras as one stand-in, and reads a moved group as a group", async () => {
  const parts = await deck("shapes-added.pptx")
  const at = { slide: "256", part: readSlides(parts)[0]!.part, shape: "4" }
  const set = { set: { outer } }
  const written = writeTrait(
    writeTrait(writeTrait(parts, at, "effects", { shadow: set }), at, "effects", { drop1: set }),
    at,
    "effects",
    {
      drop2: set,
    },
  )
  expect(writeTrait(written, at, "effects", { drop2: set })).toBe(written)
  const shown = shownEffects(written, at)
  expect(shown?.shadow.value).toEqual({ outer })
  expect(shown?.drop1.value).toEqual({ outer })
  expect(shown?.drop2.value).toEqual({ outer })
  expect(shown?.drop1.own).toBe(true)
  const before = decodeUtf8(written.get(at.part)!)
  expect(before).toContain(`uri="${effectsUri}"`)
  expect(before.split("<adf:drop ").length - 1).toBe(2)
  const wrapped = writtenStandIn(written, at, png)
  expect(writtenStandIn(wrapped, at, png)).toBe(wrapped)
  expect(markupDocument(wrapped.get(at.part)!).wellFormed).toBe(true)
  expect(extensionDrops(wrapped, at)).toEqual([])
  const again = shownEffects(wrapped, at)
  expect(again?.shadow.value).toEqual({ outer })
  expect(again?.drop1.value).toEqual({ outer })
  expect(again?.drop2.value).toEqual({ outer })
  const xml = decodeUtf8(wrapped.get(at.part)!)
  expect(xml.split("<a:outerShdw").length).toBe(before.split("<a:outerShdw").length)
  const { elements } = markupDocument(wrapped.get(at.part)!)
  const record = standRecords(elements, markupChildren(elements))[0]
  if (record === undefined) throw new Error("stand-in")
  expect(record.matched).toBe(true)
  expect(record.shape).toBe("4")
  const shapes = readShapes(wrapped).filter((shape) => shape.part === at.part)
  expect(shapes.some((shape) => shape.shape === "4")).toBe(true)
  expect(shapes.some((shape) => shape.shape === record.group || shape.shape === record.picture)).toBe(false)
  expect(shapes.find((shape) => shape.shape === "4")?.group).toBeUndefined()
  const painted = paintReader(wrapped).slide(at.part).elements
  expect(painted.find((element) => element.shape === "4")?.effects?.drops).toHaveLength(2)
  expect(painted.some((element) => element.shape === record.group || element.shape === record.picture)).toBe(false)
  const marker = /<adf:stand[^>]* x="(-?\d+)"/.exec(xml)
  const x = marker?.[1]
  if (x === undefined) throw new Error("marker")
  const needle = `<a:off x="${x}"`
  const atOff = xml.indexOf(needle)
  const movedXml = `${xml.slice(0, atOff)}<a:off x="${String(Number(x) + 1000)}"${xml.slice(atOff + needle.length)}`
  const moved = new Map(wrapped)
  moved.set(at.part, encodeUtf8(movedXml))
  const opened = readShapes(moved).filter((shape) => shape.part === at.part)
  expect(opened.some((shape) => shape.shape === record.group)).toBe(true)
  expect(opened.some((shape) => shape.shape === record.picture)).toBe(true)
  expect(opened.some((shape) => shape.shape === "4")).toBe(true)
  expect(shownEffects(moved, at)?.drop1.value).toEqual({ none: true })
  expect(shownEffects(moved, at)?.drop2.value).toEqual({ none: true })
  expect(shownEffects(moved, at)?.shadow.value).toEqual({ outer })
  const seen = paintReader(moved).slide(at.part).elements
  expect(seen.some((element) => element.shape === record.picture)).toBe(true)
  expect(seen.find((element) => element.shape === "4")?.effects?.drops).toBeUndefined()
})
