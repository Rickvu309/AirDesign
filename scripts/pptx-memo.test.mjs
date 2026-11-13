import assert from "node:assert/strict"
import { memoPptx } from "./pptx-memo.mjs"

const calls = []
const counted = (kind) => (parts) => {
  const rows = []
  for (const [name, bytes] of parts) {
    calls.push(`${kind} ${name}`)
    rows.push({ part: name, size: bytes.length })
  }
  return rows
}
const pptx = memoPptx({
  shapeIdCounts: counted("ids"),
  branchOrderErrors: counted("order"),
  danglingMarkReferences: counted("dangling"),
  danglingPackageReferences: (parts) => {
    calls.push(`package ${[...parts.keys()].join(" ")}`)
    return parts.has("ppt/media/image1.png") ? [] : [{ part: "ppt/slides/_rels/slide1.xml.rels", id: "rId2" }]
  },
  routeOperations: ["kept"],
})

const slide = new Uint8Array([1, 2, 3])
const same = new Uint8Array([1, 2, 3])
const other = new Uint8Array([1, 2, 3, 4])
const first = pptx.shapeIdCounts(
  new Map([
    ["ppt/slides/slide1.xml", slide],
    ["ppt/media/image1.png", slide],
  ]),
)
const second = pptx.shapeIdCounts(
  new Map([
    ["ppt/slides/slide1.xml", same],
    ["ppt/media/image1.png", slide],
  ]),
)
assert.deepEqual(first, second)
assert.deepEqual(first, [
  { part: "ppt/slides/slide1.xml", size: 3 },
  { part: "ppt/media/image1.png", size: 3 },
])
assert.equal(calls.filter((call) => call === "ids ppt/slides/slide1.xml").length, 1)
assert.equal(calls.filter((call) => call === "ids ppt/media/image1.png").length, 2)

pptx.shapeIdCounts(new Map([["ppt/slides/slide1.xml", other]]))
assert.equal(calls.filter((call) => call === "ids ppt/slides/slide1.xml").length, 2)

pptx.shapeIdCounts(new Map([["ppt/slides/slide2.xml", slide]]))
assert.equal(calls.filter((call) => call === "ids ppt/slides/slide2.xml").length, 1)

pptx.branchOrderErrors(new Map([["ppt/slides/slide1.xml", slide]]))
assert.equal(calls.filter((call) => call.startsWith("order")).length, 1)
assert.deepEqual(pptx.routeOperations, ["kept"])

const pictured = new Map([
  ["ppt/slides/slide1.xml", slide],
  ["ppt/slides/_rels/slide1.xml.rels", other],
  ["ppt/media/image1.png", slide],
])
assert.deepEqual(
  pptx.danglingShapeReferences(pictured).filter((row) => row.id !== undefined),
  [],
  "a relationship is judged against the whole package, so a target that exists is not dangling",
)
assert.deepEqual(
  calls.filter((call) => call.startsWith("package")),
  ["package ppt/slides/slide1.xml ppt/slides/_rels/slide1.xml.rels ppt/media/image1.png"],
)
pictured.delete("ppt/media/image1.png")
assert.deepEqual(
  pptx.danglingShapeReferences(pictured).filter((row) => row.id !== undefined),
  [{ part: "ppt/slides/_rels/slide1.xml.rels", id: "rId2" }],
)
