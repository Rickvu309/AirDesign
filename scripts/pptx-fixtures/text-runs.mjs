import { storedZip } from "../stored-zip.mjs"

export const textRunsParagraphs = [
  '<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="3200"/><a:t>Revenue </a:t></a:r><a:r><a:rPr lang="en-US" sz="3200" b="1"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:rPr><a:t>39%</a:t></a:r></a:p>',
  '<a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="2800"><a:latin typeface="Georgia"/></a:rPr><a:t>Costs </a:t></a:r><a:r><a:rPr lang="en-US" sz="2400" i="1"><a:solidFill><a:srgbClr val="007040"/></a:solidFill><a:latin typeface="Verdana"/></a:rPr><a:t>fell</a:t></a:r></a:p>',
]

export function textRunsParts(original) {
  const parts = new Map(original)
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Revenue"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="7315200" cy="2743200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>' +
        textRunsParagraphs.join("") +
        "</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>",
    ),
  )
  return parts
}

export const textRunsDeck = (original) => storedZip(textRunsParts(original))

export function repeatedTextParts(original) {
  const parts = textRunsParts(original)
  const xml = parts.get("ppt/slides/slide1.xml").toString("utf8")
  parts.set("ppt/slides/slide1.xml", Buffer.from(xml.replace("Revenue ", "1").replace("39%", "1")))
  return parts
}

export const repeatedTextDeck = (original) => storedZip(repeatedTextParts(original))
