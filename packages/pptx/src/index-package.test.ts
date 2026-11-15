import { expect, it, vi } from "vitest"
import { elementId, readTableValue, writeTextValue } from "@airdesign/document"
import { indexPackage } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const reads = vi.hoisted(() => ({ parts: [] as Uint8Array[] }))

vi.mock("./markup-reader.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./markup-reader.js")>()
  return {
    ...original,
    readMarkup: (bytes: Uint8Array, full: boolean) => {
      reads.parts.push(bytes)
      return original.readMarkup(bytes, full)
    },
  }
})

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const parts = new Map([
  [
    "ppt/presentation.xml",
    xml('<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>'),
  ],
  [
    "ppt/_rels/presentation.xml.rels",
    xml(
      '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    ),
  ],
  [
    "ppt/slides/slide1.xml",
    xml(
      '<p:sld><p:cSld><p:spTree><p:grpSp><p:nvGrpSpPr><p:cNvPr id="2"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="3"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>',
    ),
  ],
])

it("indexes stable slide ids, group children, table kinds, text floors, and opening boxes", () => {
  const index = indexPackage(parts)
  expect(index.slides).toEqual([{ id: "258", position: 0, free: 5, animated: [] }])
  expect(index.elements).toEqual([
    { node: elementId("258.2"), kind: "group", value: null, box: { x: 10, y: 20, cx: 30, cy: 40 }, grouped: false },
    {
      node: elementId("258.3"),
      kind: "shape",
      value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
      box: { x: 1, y: 2, cx: 3, cy: 4 },
      grouped: true,
      group: elementId("258.2"),
    },
    { node: elementId("258.4"), kind: "table", value: null, box: null, grouped: false },
  ])
  expect(indexPackage(new Map([...parts].reverse()))).toEqual(index)
})

it("records the slide size, the first free shape id and the shapes an animation names", () => {
  const sized = new Map(parts)
  sized.set(
    "ppt/presentation.xml",
    xml(
      '<p:presentation><p:sldSz cx="12192000" cy="6858000"/><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>',
    ),
  )
  sized.set(
    "ppt/slides/slide1.xml",
    xml(
      '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2"/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="9"/></p:nvSpPr></p:sp></p:spTree></p:cSld><p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="9"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing></p:sld>',
    ),
  )
  expect(indexPackage(sized).slides).toEqual([
    { id: "258", position: 0, size: { width: 12192000, height: 6858000 }, free: 10, animated: ["9"] },
  ])
})

it("reads each part's markup once while it indexes a deck", () => {
  const fresh = new Map([...parts].map(([name, bytes]) => [name, bytes.slice()]))
  reads.parts.length = 0
  indexPackage(fresh)
  const counts = new Map<string, number>()
  for (const read of reads.parts) {
    const name = [...fresh].find(([, bytes]) => bytes === read)?.[0] ?? "a copy of a part"
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  expect(Object.fromEntries(counts)).toEqual({
    "ppt/presentation.xml": 1,
    "ppt/_rels/presentation.xml.rels": 1,
    "ppt/slides/slide1.xml": 1,
  })
})

it("indexes a shape that shares its id with a fallback copy as kept, so no edit reaches it", () => {
  const fallback = new Map(parts)
  fallback.set(
    "ppt/slides/slide1.xml",
    xml(
      '<p:sld><p:cSld><p:spTree><mc:AlternateContent><mc:Choice Requires="a14"><p:sp><p:nvSpPr><p:cNvPr id="5"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>New</a:t></a:r></a:p></p:txBody></p:sp></mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="5"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Old</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent><p:sp><p:nvSpPr><p:cNvPr id="6"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Free</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    ),
  )
  expect(indexPackage(fallback).elements.map(({ node, kind }) => [node, kind])).toEqual([
    ["258.5", "kept"],
    ["258.6", "shape"],
  ])
})

it("indexes a table's value, so an agent reads its cells and sends them back with set", () => {
  const cell = (text: string) =>
    `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`
  const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="200" cy="100"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="100"/><a:gridCol w="100"/></a:tblGrid><a:tr h="100">${cell("Region")}${cell("Sales")}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
  const slide = parts.get("ppt/slides/slide1.xml")!
  const tabled = new Map(parts)
  tabled.set("ppt/slides/slide1.xml", xml(decodeUtf8(slide).replace("</p:spTree>", `${table}</p:spTree>`)))
  const indexed = indexPackage(tabled).elements.find((each) => each.node === elementId("258.5"))
  expect(indexed?.kind).toBe("table")
  expect(readTableValue(indexed?.value ?? "")?.rows).toEqual([
    {
      from: 0,
      cells: [[{ from: 0, runs: [{ from: 0, text: "Region" }] }], [{ from: 0, runs: [{ from: 0, text: "Sales" }] }]],
    },
  ])
})
