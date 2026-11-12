import { describe, expect, it } from "vitest"
import { newSharedOwnedParts, sharedOwnedParts } from "./owned-parts.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partTouch, touchMatches } from "./route-parts.js"
import { applyStructuralRoute } from "./structural-route.js"

const officeRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const officeRel2011 = "http://schemas.microsoft.com/office/2011/relationships"
const officeRel2007 = "http://schemas.microsoft.com/office/2007/relationships"
const packageRels = "http://schemas.openxmlformats.org/package/2006/relationships"
const chartType = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
const styleType = "application/vnd.ms-office.chartstyle+xml"
const colorsType = "application/vnd.ms-office.chartcolorstyle+xml"
const notesType = "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"
const dataType = "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml"
const drawingType = "application/vnd.ms-office.drawingml.diagramDrawing+xml"
const slideType = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"

const text = (value: string) => encodeUtf8(value)

function rels(rows: readonly (readonly [string, string, string])[]): string {
  const body = rows.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
  return `<Relationships xmlns="${packageRels}">${body.join("")}</Relationships>`
}

function deck(): Map<string, Uint8Array> {
  return new Map([
    [
      "[Content_Types].xml",
      text(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/slides/slide1.xml" ContentType="${slideType}"/><Override PartName="/ppt/charts/chart1.xml" ContentType="${chartType}"/><Override PartName="/ppt/charts/style1.xml" ContentType="${styleType}"/><Override PartName="/ppt/charts/colors1.xml" ContentType="${colorsType}"/><Override PartName="/ppt/charts/chart7.xml" ContentType="${chartType}"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="${notesType}"/><Override PartName="/ppt/diagrams/data1.xml" ContentType="${dataType}"/><Override PartName="/ppt/diagrams/drawing1.xml" ContentType="${drawingType}"/></Types>`,
      ),
    ],
    [
      "ppt/presentation.xml",
      text(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`),
    ],
    ["ppt/_rels/presentation.xml.rels", text(rels([["rId2", `${officeRel}/slide`, "slides/slide1.xml"]]))],
    ["ppt/slides/slide1.xml", text(`<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>`)],
    [
      "ppt/slides/_rels/slide1.xml.rels",
      text(
        rels([
          ["rId1", `${officeRel}/slideLayout`, "../slideLayouts/slideLayout1.xml"],
          ["rId2", `${officeRel}/chart`, "../charts/chart1.xml"],
          ["rId3", `${officeRel}/image`, "../media/image1.png"],
          ["rId4", `${officeRel}/notesSlide`, "../notesSlides/notesSlide1.xml"],
          ["rId5", `${officeRel}/diagramData`, "../diagrams/data1.xml"],
          ["rId6", `${officeRel2007}/diagramDrawing`, "../diagrams/drawing1.xml"],
          ["rId7", `${officeRel}/slide`, "slide1.xml"],
        ]),
      ),
    ],
    ["ppt/slideLayouts/slideLayout1.xml", text(`<p:sldLayout/>`)],
    ["ppt/media/image1.png", text("png")],
    ["ppt/charts/chart1.xml", text(`<c:chartSpace><c:externalData r:id="rId3"/></c:chartSpace>`)],
    [
      "ppt/charts/_rels/chart1.xml.rels",
      text(
        rels([
          ["rId3", `${officeRel}/package`, "../embeddings/Microsoft_Excel_Worksheet.xlsx"],
          ["rId2", `${officeRel2011}/chartColorStyle`, "colors1.xml"],
          ["rId1", `${officeRel2011}/chartStyle`, "style1.xml"],
          ["rId4", `${officeRel}/image`, "../media/image1.png"],
        ]),
      ),
    ],
    ["ppt/charts/chart7.xml", text(`<c:chartSpace/>`)],
    ["ppt/charts/style1.xml", text(`<cs:chartStyle/>`)],
    ["ppt/charts/colors1.xml", text(`<cs:colorStyle/>`)],
    ["ppt/embeddings/Microsoft_Excel_Worksheet.xlsx", text("workbook")],
    ["ppt/notesSlides/notesSlide1.xml", text(`<p:notes/>`)],
    [
      "ppt/notesSlides/_rels/notesSlide1.xml.rels",
      text(
        rels([
          ["rId1", `${officeRel}/notesMaster`, "../notesMasters/notesMaster1.xml"],
          ["rId2", `${officeRel}/slide`, "../slides/slide1.xml"],
        ]),
      ),
    ],
    ["ppt/notesMasters/notesMaster1.xml", text(`<p:notesMaster/>`)],
    ["ppt/diagrams/data1.xml", text(`<dgm:dataModel/>`)],
    ["ppt/diagrams/drawing1.xml", text(`<dsp:drawing/>`)],
  ])
}

function xml(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return decodeUtf8(bytes)
}

const copyRels = "ppt/slides/_rels/slide2.xml.rels"

describe("parts a cloned slide owns", () => {
  it("gives the copy its own chart, workbook, style, colors, notes and diagram parts", () => {
    const parts = deck()
    const cloned = applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "256" })
    expect(xml(cloned, copyRels)).toBe(
      rels([
        ["rId1", `${officeRel}/slideLayout`, "../slideLayouts/slideLayout1.xml"],
        ["rId2", `${officeRel}/chart`, "../charts/chart8.xml"],
        ["rId3", `${officeRel}/image`, "../media/image1.png"],
        ["rId4", `${officeRel}/notesSlide`, "../notesSlides/notesSlide2.xml"],
        ["rId5", `${officeRel}/diagramData`, "../diagrams/data2.xml"],
        ["rId6", `${officeRel2007}/diagramDrawing`, "../diagrams/drawing2.xml"],
        ["rId7", `${officeRel}/slide`, "slide1.xml"],
      ]),
    )
    expect(xml(cloned, "ppt/charts/_rels/chart8.xml.rels")).toBe(
      rels([
        ["rId3", `${officeRel}/package`, "../embeddings/Microsoft_Excel_Worksheet1.xlsx"],
        ["rId2", `${officeRel2011}/chartColorStyle`, "colors2.xml"],
        ["rId1", `${officeRel2011}/chartStyle`, "style2.xml"],
        ["rId4", `${officeRel}/image`, "../media/image1.png"],
      ]),
    )
    expect(xml(cloned, "ppt/notesSlides/_rels/notesSlide2.xml.rels")).toBe(
      rels([
        ["rId1", `${officeRel}/notesMaster`, "../notesMasters/notesMaster1.xml"],
        ["rId2", `${officeRel}/slide`, "../slides/slide2.xml"],
      ]),
    )
    for (const [copy, source] of [
      ["ppt/charts/chart8.xml", "ppt/charts/chart1.xml"],
      ["ppt/charts/style2.xml", "ppt/charts/style1.xml"],
      ["ppt/charts/colors2.xml", "ppt/charts/colors1.xml"],
      ["ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx", "ppt/embeddings/Microsoft_Excel_Worksheet.xlsx"],
      ["ppt/notesSlides/notesSlide2.xml", "ppt/notesSlides/notesSlide1.xml"],
      ["ppt/diagrams/data2.xml", "ppt/diagrams/data1.xml"],
      ["ppt/diagrams/drawing2.xml", "ppt/diagrams/drawing1.xml"],
    ] as const) {
      expect(cloned.get(copy), copy).toBe(parts.get(source))
    }
    const types = xml(cloned, "[Content_Types].xml")
    for (const [name, type] of [
      ["ppt/charts/chart8.xml", chartType],
      ["ppt/charts/style2.xml", styleType],
      ["ppt/charts/colors2.xml", colorsType],
      ["ppt/notesSlides/notesSlide2.xml", notesType],
      ["ppt/diagrams/data2.xml", dataType],
      ["ppt/diagrams/drawing2.xml", drawingType],
    ] as const) {
      expect(types).toContain(`<Override PartName="/${name}" ContentType="${type}"/>`)
    }
    expect(types).not.toContain("Microsoft_Excel_Worksheet1")
    for (const [name, bytes] of parts) {
      if (name === "[Content_Types].xml" || name.startsWith("ppt/presentation") || name.startsWith("ppt/_rels"))
        continue
      expect(cloned.get(name), name).toBe(bytes)
    }
    expect(sharedOwnedParts(cloned)).toEqual([])
  })

  it("names every part the clone writes in its touch", () => {
    const parts = deck()
    const route = { name: "sldIdLst.clone", slide: "256" } as const
    const cloned = applyStructuralRoute(parts, route)
    const touch = partTouch(parts, route)
    expect(touchMatches(parts, cloned, touch)).toBe(true)
    expect(touch.added).toContain("ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx")
  })

  it("names two slides that point at one chart and leaves a shared picture alone", () => {
    const parts = deck()
    parts.set("ppt/slides/slide2.xml", text(`<p:sld/>`))
    parts.set(
      copyRels,
      text(
        rels([
          ["rId2", `${officeRel}/chart`, "/ppt/charts/chart1.xml"],
          ["rId3", `${officeRel}/image`, "../media/image1.png"],
        ]),
      ),
    )
    expect(sharedOwnedParts(parts)).toEqual([
      { part: "ppt/charts/chart1.xml", owners: ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"] },
    ])
    expect(newSharedOwnedParts(sharedOwnedParts(deck()), sharedOwnedParts(parts))).toEqual(sharedOwnedParts(parts))
    expect(newSharedOwnedParts(sharedOwnedParts(parts), sharedOwnedParts(parts))).toEqual([])
  })
})
