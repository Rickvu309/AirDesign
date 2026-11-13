import { encodeUtf8 as text } from "./package-bytes.js"

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Hello</a:t></a:r></a:p><a:p><a:r><a:t>World</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="G"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9" cy="9"/><a:chOff x="0" y="0"/><a:chExt cx="9" cy="9"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="11" name="C"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp></p:grpSp><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr><a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr></a:tbl></p:spTree></p:cSld></p:sld>`

export function routeHosts(): Map<string, Uint8Array> {
  return new Map([
    ["ppt/slides/slide1.xml", text(slide)],
    [
      "ppt/slides/slide2.xml",
      text(
        `<p:sld><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Grid"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="20" cy="1"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="10"/><a:gridCol w="10"/></a:tblGrid></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
      ),
    ],
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
