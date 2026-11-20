import type { Guide } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { indexPackage, readParts } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readSlideGuides, writeSlideGuides } from "./guide-list.js"

declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const eighth = 1587.5
const at = (pos: number) => Math.round(pos * eighth)
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))

function slideOnly(inner: string): Map<string, Uint8Array> {
  return new Map([["ppt/slides/slide1.xml", encodeUtf8(`<p:sld><p:cSld><p:spTree/></p:cSld>${inner}</p:sld>`)]])
}

describe("a slide's guides in PowerPoint", () => {
  it("reads the deck's, the layout's and the master's guides as one list, each line once", async () => {
    const parts = await fixture("census-updating-spm.pptx")
    expect(readSlideGuides(parts, "ppt/slides/slide1.xml")).toEqual([
      { axis: "y", offset: at(2160) },
      { axis: "x", offset: at(3840) },
      { axis: "x", offset: at(7333) },
      { axis: "x", offset: at(362) },
      { axis: "x", offset: at(325) },
      { axis: "x", offset: at(7349) },
    ])
  })

  it("reads no guides from a deck that has none", async () => {
    const parts = await fixture("blank.pptx")
    expect(readSlideGuides(parts, "ppt/slides/slide1.xml")).toEqual([])
    expect(indexPackage(parts).slides[0]?.guides).toBeUndefined()
  })

  it("indexes each slide's guides, so an agent reads them", async () => {
    const parts = await fixture("census-updating-spm.pptx")
    expect(indexPackage(parts).slides[0]?.guides).toEqual(readSlideGuides(parts, "ppt/slides/slide1.xml"))
  })

  it("writes changed guides into an AirDesign extension on the slide and reads them back first", async () => {
    const parts = await fixture("census-updating-spm.pptx")
    const chosen: readonly Guide[] = [
      { axis: "x", offset: 914_400 },
      { axis: "y", offset: -12_700 },
    ]
    const next = writeSlideGuides(parts, "ppt/slides/slide1.xml", chosen)
    expect(readSlideGuides(next, "ppt/slides/slide1.xml")).toEqual(chosen)
    expect(readSlideGuides(next, "ppt/slides/slide2.xml")).toEqual(readSlideGuides(parts, "ppt/slides/slide2.xml"))
    for (const [name, bytes] of parts) if (name !== "ppt/slides/slide1.xml") expect(next.get(name)).toBe(bytes)
    const before = text(parts.get("ppt/slides/slide1.xml"))
    const after = text(next.get("ppt/slides/slide1.xml"))
    const added = after.slice(before.length - "</p:sld>".length, after.length - "</p:sld>".length)
    expect(after.startsWith(before.slice(0, before.length - "</p:sld>".length))).toBe(true)
    expect(added).toBe(
      '<p:extLst><p:ext uri="{B7EA18BA-A583-420B-AA80-A42F3E0419E5}"><ag:guides xmlns:ag="https://airdesign.app/2026/guides"><ag:guide axis="x" offset="914400"/><ag:guide axis="y" offset="-12700"/></ag:guides></p:ext></p:extLst>',
    )
  })

  it("keeps an empty list, so a slide can have no guides where the deck has some", async () => {
    const parts = await fixture("census-updating-spm.pptx")
    const next = writeSlideGuides(parts, "ppt/slides/slide1.xml", [])
    expect(readSlideGuides(next, "ppt/slides/slide1.xml")).toEqual([])
  })

  it("replaces its own extension and keeps the slide's other extensions in place", () => {
    const parts = slideOnly(
      '<p:clrMapOvr/><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId val="1"/></p:ext></p:extLst>',
    )
    const once = writeSlideGuides(parts, "ppt/slides/slide1.xml", [{ axis: "x", offset: 1 }])
    const twice = writeSlideGuides(once, "ppt/slides/slide1.xml", [{ axis: "y", offset: 2 }])
    expect(text(twice.get("ppt/slides/slide1.xml"))).toBe(
      '<p:sld><p:cSld><p:spTree/></p:cSld><p:clrMapOvr/><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId val="1"/></p:ext><p:ext uri="{B7EA18BA-A583-420B-AA80-A42F3E0419E5}"><ag:guides xmlns:ag="https://airdesign.app/2026/guides"><ag:guide axis="y" offset="2"/></ag:guides></p:ext></p:extLst></p:sld>',
    )
  })

  it("reads a guide list it cannot trust as the deck's own", async () => {
    const parts = await fixture("census-updating-spm.pptx")
    const bytes = text(parts.get("ppt/slides/slide1.xml"))
    const broken = new Map(parts).set(
      "ppt/slides/slide1.xml",
      encodeUtf8(
        bytes.replace(
          "</p:sld>",
          '<p:extLst><p:ext uri="{B7EA18BA-A583-420B-AA80-A42F3E0419E5}"><ag:guides xmlns:ag="https://airdesign.app/2026/guides"><ag:guide axis="z" offset="1"/></ag:guides></p:ext></p:extLst></p:sld>',
        ),
      ),
    )
    expect(readSlideGuides(broken, "ppt/slides/slide1.xml")).toEqual(readSlideGuides(parts, "ppt/slides/slide1.xml"))
  })
})
