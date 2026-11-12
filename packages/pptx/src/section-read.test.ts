import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { readSections, sectionStarts } from "./section-read.js"

function presentationWith(sections: string): ReadonlyMap<string, Uint8Array> {
  const xml = `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst><p:sldSz cx="1" cy="1"/>${sections}</p:presentation>`
  return new Map([["ppt/presentation.xml", encodeUtf8(xml)]])
}

const list = (body: string) =>
  `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${body}</p14:sectionLst></p:ext></p:extLst>`

describe("readSections", () => {
  it("reads each section name with its slide ids in order", () => {
    const parts = presentationWith(
      list(
        `<p14:section name="Opening &amp; plan" id="{A}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section>` +
          `<p14:section name="Numbers" id="{B}"><p14:sldIdLst><p14:sldId id="257"/><p14:sldId id="258"/></p14:sldIdLst></p14:section>`,
      ),
    )
    expect(readSections(parts)).toEqual([
      { name: "Opening & plan", slides: ["256"] },
      { name: "Numbers", slides: ["257", "258"] },
    ])
  })

  it("keeps an empty section as a name with no slides", () => {
    const parts = presentationWith(
      list(
        `<p14:section name="Empty" id="{A}"><p14:sldIdLst/></p14:section>` +
          `<p14:section name="All" id="{B}"><p14:sldIdLst><p14:sldId id="256"/><p14:sldId id="257"/><p14:sldId id="258"/></p14:sldIdLst></p14:section>`,
      ),
    )
    expect(readSections(parts)).toEqual([
      { name: "Empty", slides: [] },
      { name: "All", slides: ["256", "257", "258"] },
    ])
  })

  it("reads no sections from a deck without a section list", () => {
    expect(readSections(presentationWith(""))).toEqual([])
  })

  it("reads no sections when a slide is missing from the sections or listed twice", () => {
    const missing = presentationWith(
      list(`<p14:section name="One" id="{A}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section>`),
    )
    expect(readSections(missing)).toEqual([])
    const twice = presentationWith(
      list(
        `<p14:section name="One" id="{A}"><p14:sldIdLst><p14:sldId id="256"/><p14:sldId id="257"/></p14:sldIdLst></p14:section>` +
          `<p14:section name="Two" id="{B}"><p14:sldIdLst><p14:sldId id="257"/><p14:sldId id="258"/></p14:sldIdLst></p14:section>`,
      ),
    )
    expect(readSections(twice)).toEqual([])
  })
})

describe("sectionStarts", () => {
  const body = (first: string, second: string) =>
    list(
      `<p14:section name="One" id="{A}"><p14:sldIdLst>${first}</p14:sldIdLst></p14:section>` +
        `<p14:section name="Empty" id="{E}"><p14:sldIdLst/></p14:section>` +
        `<p14:section name="Two" id="{B}"><p14:sldIdLst>${second}</p14:sldIdLst></p14:section>`,
    )

  it("gives the name and the slide each non-empty section starts at, in slide order", () => {
    const parts = presentationWith(body('<p14:sldId id="256"/>', '<p14:sldId id="257"/><p14:sldId id="258"/>'))
    expect(sectionStarts(parts)).toEqual([
      { name: "One", start: 0 },
      { name: "Two", start: 1 },
    ])
  })

  it("gives no sections when a section is not a run of slides in the slide order", () => {
    const apart = presentationWith(body('<p14:sldId id="256"/><p14:sldId id="258"/>', '<p14:sldId id="257"/>'))
    expect(sectionStarts(apart)).toEqual([])
    const backwards = presentationWith(body('<p14:sldId id="258"/>', '<p14:sldId id="256"/><p14:sldId id="257"/>'))
    expect(sectionStarts(backwards)).toEqual([])
  })

  it("gives the one section of a deck with a single section", () => {
    const parts = presentationWith(
      list(
        `<p14:section name="All" id="{A}"><p14:sldIdLst><p14:sldId id="256"/><p14:sldId id="257"/><p14:sldId id="258"/></p14:sldIdLst></p14:section>`,
      ),
    )
    expect(sectionStarts(parts)).toEqual([{ name: "All", start: 0 }])
  })
})
