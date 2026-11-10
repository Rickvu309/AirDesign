import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partTouch, routeOperations, routeRuns, touchMatches } from "./route-parts.js"

function text(value: string): Uint8Array {
  return encodeUtf8(value)
}

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="G"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9" cy="9"/><a:chOff x="0" y="0"/><a:chExt cx="9" cy="9"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="11" name="C"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp></p:grpSp><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr><a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr></a:tbl></p:spTree></p:cSld></p:sld>`

function hosts(): Map<string, Uint8Array> {
  return new Map([
    ["ppt/slides/slide1.xml", text(slide)],
    ["ppt/slides/slide2.xml", text("<p:sld/>")],
    [
      "ppt/presentation.xml",
      text(
        `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="1" cy="1"/><p14:section id="1"/><p14:section id="2"/></p:presentation>`,
      ),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      text(
        `<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide3.xml"/></Relationships>`,
      ),
    ],
    ["ppt/slides/slide3.xml", text("<p:sld/>")],
    ["ppt/media/keep.bin", Uint8Array.of(1, 2, 3)],
  ])
}

describe("partTouch", () => {
  it("says a text edit changes only that slide", () => {
    expect(
      partTouch(hosts(), { name: "text", part: "ppt/slides/slide1.xml", shape: "2", text: "AirDesignProbe" }),
    ).toEqual({ changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })
  })

  it("names the next slide file from the highest number, including a gap", () => {
    expect(partTouch(hosts(), { name: "sldIdLst.add", after: "256" })).toEqual({
      changed: ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "[Content_Types].xml"],
      added: ["ppt/slides/slide4.xml", "ppt/slides/_rels/slide4.xml.rels"],
      removed: [],
    })
  })

  it("removes the slide the relationship names, not the next file number", () => {
    expect(partTouch(hosts(), { name: "sldIdLst.remove", slide: "257" })).toEqual({
      changed: ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "[Content_Types].xml"],
      added: [],
      removed: ["ppt/slides/slide3.xml", "ppt/slides/_rels/slide3.xml.rels"],
    })
  })

  it("rejects a byte change outside the declared parts", () => {
    const before = hosts()
    const after = new Map(before)
    after.set("ppt/slides/slide1.xml", text("<p:sld>edited</p:sld>"))
    after.set("ppt/media/keep.bin", Uint8Array.of(9))
    expect(touchMatches(before, after, { changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })).toBe(false)
  })

  it("rejects a declared part that did not change", () => {
    const before = hosts()
    expect(touchMatches(before, before, { changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })).toBe(false)
  })
})

describe("routeRuns", () => {
  it("attempts every written route when the deck has a host for each", () => {
    const operations = routeRuns(hosts()).map((run) => run.operation)
    expect([...operations].sort()).toEqual([...routeOperations].sort())
  })

  it("does not remove the only row of a table", () => {
    const parts = hosts()
    const bytes = parts.get("ppt/slides/slide1.xml")
    if (bytes === undefined) throw new Error("part")
    parts.set(
      "ppt/slides/slide1.xml",
      text(decodeUtf8(bytes).replace(`<a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr>`, "")),
    )
    const operations = routeRuns(parts).map((run) => run.operation)
    expect(operations).toContain("tbl.addRow")
    expect(operations).not.toContain("tbl.removeRow")
  })
})
