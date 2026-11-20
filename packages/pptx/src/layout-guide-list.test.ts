import type { LayoutGuide } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readLayoutGuideList, writeLayoutGuideList } from "./layout-guide-list.js"
import { readSlideGuides } from "./guide-list.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const slide = "ppt/slides/slide1.xml"
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const tone = { color: "FF0000", opacity: 10, shown: true }
const chosen: readonly LayoutGuide[] = [
  { pattern: "grid", count: 1, align: "stretch", size: 127_000, offset: 0, gutter: 0, ...tone },
  { pattern: "columns", count: 12, align: "stretch", size: 0, offset: 457_200, gutter: 254_000, ...tone },
  {
    pattern: "rows",
    count: 3,
    align: "start",
    size: 1_270_000,
    offset: 0,
    gutter: 0,
    color: "00AAFF",
    opacity: 25,
    shown: false,
  },
]

function slideOnly(inner: string): Map<string, Uint8Array> {
  return new Map([[slide, encodeUtf8(`<p:sld><p:cSld><p:spTree/></p:cSld>${inner}</p:sld>`)]])
}

describe("a slide's layout guides in PowerPoint", () => {
  it("reads none from a slide that has no AirDesign extension", () => {
    expect(readLayoutGuideList(slideOnly("<p:clrMapOvr/>"), slide)).toEqual([])
  })

  it("writes them into their own AirDesign extension and reads them back", () => {
    const parts = slideOnly("<p:clrMapOvr/>")
    const written = writeLayoutGuideList(parts, slide, chosen)
    expect(readLayoutGuideList(written, slide)).toEqual(chosen)
    expect(text(written.get(slide))).toBe(
      '<p:sld><p:cSld><p:spTree/></p:cSld><p:clrMapOvr/><p:extLst><p:ext uri="{69A285BF-2CD7-437C-98FB-1F09AAAED3C1}"><ag:layoutGuides xmlns:ag="https://airdesign.app/2026/guides"><ag:layoutGuide pattern="grid" count="1" align="stretch" size="127000" offset="0" gutter="0" color="FF0000" opacity="10" shown="1"/><ag:layoutGuide pattern="columns" count="12" align="stretch" size="0" offset="457200" gutter="254000" color="FF0000" opacity="10" shown="1"/><ag:layoutGuide pattern="rows" count="3" align="start" size="1270000" offset="0" gutter="0" color="00AAFF" opacity="25" shown="0"/></ag:layoutGuides></p:ext></p:extLst></p:sld>',
    )
  })

  it("keeps the slide's guides beside its layout guides", () => {
    const parts = slideOnly("<p:clrMapOvr/>")
    const written = writeLayoutGuideList(parts, slide, chosen)
    expect(readSlideGuides(written, slide)).toEqual([])
    expect(readLayoutGuideList(writeLayoutGuideList(written, slide, []), slide)).toEqual([])
  })

  it("reads a layout guide list it cannot trust as none", () => {
    const parts = slideOnly(
      '<p:extLst><p:ext uri="{69A285BF-2CD7-437C-98FB-1F09AAAED3C1}"><ag:layoutGuides><ag:layoutGuide pattern="grid" count="1" align="stretch" size="-1" offset="0" gutter="0" color="FF0000" opacity="10" shown="1"/></ag:layoutGuides></p:ext></p:extLst>',
    )
    expect(readLayoutGuideList(parts, slide)).toEqual([])
  })
})
