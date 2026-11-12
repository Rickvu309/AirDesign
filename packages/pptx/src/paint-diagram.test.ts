import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader, type PaintElement } from "./paint-reader.js"

const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const slide = "ppt/slides/slide5.xml"
const layout = "ppt/slideLayouts/slideLayout16.xml"
const master = "ppt/slideMasters/slideMaster1.xml"
const theme = "ppt/theme/theme1.xml"
const data = "ppt/diagrams/data1.xml"
const drawing = "ppt/diagrams/drawing1.xml"

const relationships = (rows: readonly (readonly [string, string, string])[]) =>
  `<Relationships>${rows.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`

const frame = (transform = '<a:off x="410967" y="731521"/><a:ext cx="8128000" cy="5380744"/>') =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="6" name="Diagram 5"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${transform}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds r:dm="rId3" r:lo="rId4" r:qs="rId5" r:cs="rId6"/></a:graphicData></a:graphic></p:graphicFrame>`

const chevron = (rotation = "", textRotation = "") =>
  `<dsp:sp modelId="{EBF2CA98-A0CF-45E0-AF7E-21F99408B6EE}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm${rotation}><a:off x="2381" y="2110140"/><a:ext cx="2901156" cy="1160462"/></a:xfrm><a:prstGeom prst="chevron"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:hueOff val="0"/><a:satOff val="0"/><a:lumOff val="0"/><a:alphaOff val="0"/></a:schemeClr></a:solidFill><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="lt1"><a:hueOff val="0"/><a:satOff val="0"/><a:lumOff val="0"/><a:alphaOff val="0"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:effectLst/></dsp:spPr><dsp:style><a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></dsp:style><dsp:txBody><a:bodyPr spcFirstLastPara="0" vert="horz" wrap="square" lIns="224028" tIns="74676" rIns="74676" bIns="74676" numCol="1" spcCol="1270" anchor="ctr" anchorCtr="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr marL="0" lvl="0" indent="0" algn="ctr" defTabSz="2489200"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:spcAft><a:spcPct val="35000"/></a:spcAft><a:buNone/></a:pPr><a:r><a:rPr lang="en-US" sz="5600" kern="1200" dirty="0"/><a:t>2023</a:t></a:r></a:p></dsp:txBody><dsp:txXfrm${textRotation}><a:off x="582612" y="2110140"/><a:ext cx="1740694" cy="1160462"/></dsp:txXfrm></dsp:sp>`

const treeTransform = (inside: string) => `<dsp:grpSpPr>${inside}</dsp:grpSpPr>`

const drawingXml = (shapes = chevron(), groupProperties = "<dsp:grpSpPr/>") =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dsp:drawing xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr>${groupProperties}${shapes}</dsp:spTree></dsp:drawing>`

const dataXml = (pointer = true) =>
  `<dgm:dataModel><dgm:ptLst/><dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram">${pointer ? '<dsp:dataModelExt relId="rId7" minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>' : ""}</a:ext></dgm:extLst></dgm:dataModel>`

const themeXml = `<a:theme><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="156082"/></a:accent1></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme><a:fillStyleLst/><a:lnStyleLst/></a:fmtScheme></a:themeElements></a:theme>`

const partsOf = (options: { shapes?: string; groupProperties?: string; frameShape?: string; pointer?: boolean } = {}) =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${options.frameShape ?? frame()}</p:spTree></p:cSld></p:sld>`)],
    [
      "ppt/slides/_rels/slide5.xml.rels",
      encodeUtf8(
        relationships([
          ["rId3", `${office}/diagramData`, "../diagrams/data1.xml"],
          ["rId7", "http://schemas.microsoft.com/office/2007/relationships/diagramDrawing", "../diagrams/drawing1.xml"],
          ["rId1", `${office}/slideLayout`, "../slideLayouts/slideLayout16.xml"],
        ]),
      ),
    ],
    [layout, encodeUtf8("<p:sldLayout><p:cSld><p:spTree/></p:cSld></p:sldLayout>")],
    [
      "ppt/slideLayouts/_rels/slideLayout16.xml.rels",
      encodeUtf8(relationships([["rId1", `${office}/slideMaster`, "../slideMasters/slideMaster1.xml"]])),
    ],
    [
      master,
      encodeUtf8(
        '<p:sldMaster><p:cSld><p:spTree/></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"/></p:sldMaster>',
      ),
    ],
    [
      "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      encodeUtf8(relationships([["rId1", `${office}/theme`, "../theme/theme1.xml"]])),
    ],
    [theme, encodeUtf8(themeXml)],
    [data, encodeUtf8(dataXml(options.pointer ?? true))],
    [drawing, encodeUtf8(drawingXml(options.shapes, options.groupProperties))],
  ])

const frameOf = (parts: ReadonlyMap<string, Uint8Array>): PaintElement => {
  const found = paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.kind === "p:graphicFrame")
  if (found === undefined) throw new Error("frame")
  return found
}

const box = (x: number, y: number, width: number, height: number, rotation = 0) => ({
  x,
  y,
  width,
  height,
  rotation,
  flipH: false,
  flipV: false,
})

describe("diagram paint", () => {
  it("reads the saved drawing of a SmartArt frame as shapes placed inside the frame", () => {
    const parts = partsOf()
    const before = new Map([...parts].map(([name, bytes]) => [name, bytes.slice()]))
    const diagram = frameOf(parts).diagram ?? []
    expect(diagram.map((shape) => [shape.box, shape.geometry])).toEqual([
      [box(2381, 2110140, 2901156, 1160462), "chevron"],
      [box(582612, 2110140, 1740694, 1160462), null],
    ])
    const [shape, text] = diagram
    expect(shape?.fill).toEqual({ type: "solid", color: { hex: "156082", alpha: 1 } })
    expect(shape?.line).toMatchObject({ width: 12700, fill: { type: "solid", color: { hex: "FFFFFF", alpha: 1 } } })
    expect(shape?.text).toBeNull()
    expect(text?.fill).toBeNull()
    expect(text?.line).toBeNull()
    expect(text?.text).toMatchObject({
      anchor: "middle",
      insets: { left: 224028, top: 74676, right: 74676, bottom: 74676 },
      paragraphs: [
        {
          align: "center",
          lineSpacing: { percent: 0.9 },
          runs: [{ text: "2023", size: 56, font: "Aptos", color: { hex: "FFFFFF", alpha: 1 } }],
        },
      ],
    })
    expect(new Set(diagram.map((element) => element.part))).toEqual(new Set([drawing]))
    expect(parts).toEqual(before)
  })

  it("turns the text by the shape's turn plus its own, so a turned chevron keeps upright words", () => {
    const diagram = frameOf(partsOf({ shapes: chevron(' rot="5400000"', ' rot="-5400000"') })).diagram ?? []
    expect(diagram.map((shape) => shape.box?.rotation)).toEqual([90, 0])
  })

  it("scales the drawing to the frame when the drawing names its own extents", () => {
    const groupProperties = treeTransform(
      '<a:xfrm><a:off x="0" y="0"/><a:ext cx="8128000" cy="5380744"/><a:chOff x="0" y="0"/><a:chExt cx="4064000" cy="2690372"/></a:xfrm>',
    )
    const diagram = frameOf(partsOf({ groupProperties })).diagram ?? []
    expect(diagram[0]?.box).toEqual(box(4762, 4220280, 5802312, 2320924))
  })

  it("keeps the frame unpainted when it has no saved drawing", () => {
    expect(frameOf(partsOf({ pointer: false })).diagram).toBeUndefined()
  })

  it("keeps the frame unpainted when the saved drawing is missing", () => {
    const parts = partsOf()
    parts.delete(drawing)
    expect(frameOf(parts).diagram).toBeUndefined()
  })
})
