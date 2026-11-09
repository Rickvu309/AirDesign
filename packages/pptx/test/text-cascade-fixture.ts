import {createNativePresentation} from "../src/native.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {parseXml} from "../src/xml.ts"
import type {TextStyle} from "../../deck/src/text/body.ts"

const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const presentation = "http://schemas.openxmlformats.org/presentationml/2006/main"
function placeholder(body: string, type = "body", index = "7") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="77" name="Inherited"/><p:cNvSpPr/><p:nvPr><p:ph type="${type}" idx="${index}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>${body}</p:txBody></p:sp>`
}
export async function cascadeSource(extra = "") {
  const source = await createNativePresentation([{title: "Sibling", notes: "Retained notes", table: {headers: ["Year"], rows: [["2026"]]}, chart: {name: "Value", labels: ["A"], values: [3]}}]), parts = new Map(source.parts)
  const levels = Array.from({length: 9}, (_, index) => `<a:lvl${index + 1}pPr algn="r" marL="${(index + 1) * 9525}" indent="-9525"><a:spcAft><a:spcPts val="150"/></a:spcAft><a:buAutoNum type="arabicPeriod"/><a:defRPr sz="${1800 + index * 75}" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${index + 1}pPr>`).join("")
  parts.set("ppt/slideMasters/slideMaster1.xml", Buffer.from(`<p:sldMaster xmlns:p="${presentation}" xmlns:a="${drawing}"><p:cSld><p:spTree>${placeholder('<a:bodyPr anchor="b" lIns="19050"/><a:lstStyle><a:lvl2pPr><a:defRPr i="1"/></a:lvl2pPr></a:lstStyle><a:p/>')}</p:spTree></p:cSld><p:clrMap tx1="accent2" bg1="lt1"/><p:txStyles><p:bodyStyle>${levels}</p:bodyStyle></p:txStyles></p:sldMaster>`))
  parts.set("ppt/slideLayouts/slideLayout1.xml", Buffer.from(`<p:sldLayout xmlns:p="${presentation}" xmlns:a="${drawing}"><p:cSld><p:spTree>${placeholder('<a:bodyPr tIns="28575"/><a:lstStyle><a:lvl2pPr algn="ctr"><a:defRPr sz="3000"/></a:lvl2pPr></a:lstStyle><a:p/>')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`))
  const theme = parts.get("ppt/theme/theme1.xml")!.toString().replace(/<a:accent2>[\s\S]*?<\/a:accent2>/, '<a:accent2><a:srgbClr val="204060"/></a:accent2>').replace(/(<a:minorFont>\s*<a:latin typeface=")[^"]*/, '$1Theme Minor')
  parts.set("ppt/theme/theme1.xml", Buffer.from(theme))
  const paragraphs = Array.from({length: 9}, (_, level) => `<a:p><a:pPr lvl="${level}"${level === 1 ? ' marR="38100"' : ""}/>${level === 8 ? "" : `<a:r>${level === 1 ? '<a:rPr b="0"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:rPr>' : ""}<a:t>Level ${level}</a:t></a:r>`}</a:p>`).join("")
  const shape = placeholder(`<a:bodyPr rIns="47625"/><a:lstStyle><a:lvl2pPr><a:spcBef><a:spcPts val="225"/></a:spcBef></a:lvl2pPr></a:lstStyle>${paragraphs}${extra}`)
  parts.set("ppt/slides/slide1.xml", Buffer.from(parts.get("ppt/slides/slide1.xml")!.toString().replace("</p:spTree>", shape + "</p:spTree>")))
  return importPptx(await exportPptx({...source, parts}))
}

export type CascadeLayer = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export const competingStyles: (TextStyle & {color: string})[] = Array.from({length: 8}, (_, index) => ({font: `Cascade Family ${index}`, size: 16 + index * 4, color: `#${String(index + 1).repeat(6)}`, bold: index % 2 === 0, italic: index % 2 === 0}))
export async function competingCascadeSource(layer: CascadeLayer, options: {missingLocalLevel?: boolean; slideIndex?: string; slideTypeAbsent?: boolean; invisibleRun?: boolean} = {}) {
  const original = await cascadeSource(), parts = new Map(original.parts)
  const properties = (index: number, tag = "a:defRPr") => {
    const style = competingStyles[index]!
    return `<${tag} sz="${style.size * 75}" b="${style.bold ? 1 : 0}" i="${style.italic ? 1 : 0}">${options.invisibleRun && index === 6 ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${style.color.slice(1)}"/></a:solidFill>`}<a:latin typeface="${style.font}"/></${tag}>`
  }
  const list = (index: number, missing = false) => layer < index ? "" : `<a:lvl${missing ? 2 : 1}pPr>${properties(index)}</a:lvl${missing ? 2 : 1}pPr>`
  const replaceBody = (part: string, body: string) => {
    const document = parseXml(parts.get(part)!), node = document.nodes.filter(node => node.local === "txBody").at(-1)!
    parts.set(part, Buffer.from(document.xml.slice(0, node.start) + `<p:txBody>${body}</p:txBody>` + document.xml.slice(node.end)))
  }
  const main = "ppt/presentation.xml", xml = parts.get(main)!.toString(), defaults = `<p:defaultTextStyle>${list(0)}</p:defaultTextStyle>`
  parts.set(main, Buffer.from(xml.includes("<p:defaultTextStyle") ? xml.replace(/<p:defaultTextStyle[\s\S]*?<\/p:defaultTextStyle>/, defaults) : xml.replace("</p:presentation>", defaults + "</p:presentation>")))
  const master = "ppt/slideMasters/slideMaster1.xml"
  parts.set(master, Buffer.from(parts.get(master)!.toString().replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, `<p:bodyStyle>${list(1)}</p:bodyStyle>`)))
  replaceBody(master, `<a:bodyPr/><a:lstStyle>${list(2)}</a:lstStyle><a:p/>`)
  replaceBody("ppt/slideLayouts/slideLayout1.xml", `<a:bodyPr/><a:lstStyle>${list(3)}</a:lstStyle><a:p/>`)
  const slide = "ppt/slides/slide1.xml"
  replaceBody(slide, `<a:bodyPr/><a:lstStyle>${list(4, options.missingLocalLevel)}</a:lstStyle><a:p><a:pPr>${layer >= 5 ? properties(5) : ""}</a:pPr><a:r>${layer >= 6 ? properties(6, "a:rPr") : ""}<a:t>Competing inheritance</a:t></a:r>${layer >= 7 ? properties(7, "a:endParaRPr") : ""}</a:p>`)
  parts.set(slide, Buffer.from(parts.get(slide)!.toString().replace('<p:ph type="body" idx="7"/>', `<p:ph${options.slideTypeAbsent ? "" : ' type="body"'} idx="${options.slideIndex ?? "7"}"/>`).replace(/(<p:spPr\/>)(<p:txBody><a:bodyPr\/><a:lstStyle>)/, '$1<p:style><a:lnRef idx="0"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="major"><a:srgbClr val="010203"/></a:fontRef></p:style>$2')))
  const theme = "ppt/theme/theme1.xml"
  parts.set(theme, Buffer.from(parts.get(theme)!.toString().replace(/(<a:majorFont>\s*<a:latin typeface=")[^"]*/, '$1Cascade Theme Major')))
  return importPptx(await exportPptx({...original, parts}))
}

export async function retainedTextSource() {
  const source = await cascadeSource('<a:p><a:pPr defTabSz="457200"><a:spcBef><a:spcPts val="600"/></a:spcBef></a:pPr><a:r><a:rPr><a:sym typeface="Wingdings" pitchFamily="2" charset="2"/><a:hlinkClick r:id="retained-link" tooltip="Original"/></a:rPr><a:t>Editable\tinput &#xF0E0;</a:t></a:r><a:fld id="source-field" type="slidenum"><a:t>42</a:t></a:fld></a:p>')
  const parts = new Map(source.parts), part = "ppt/slides/slide1.xml"
  const xml = parts.get(part)!.toString().replace('<a:bodyPr rIns="47625"/>', '<a:bodyPr rIns="47625" spcFirstLastPara="1"/>')
  const start = xml.indexOf('<p:sp><p:nvSpPr><p:cNvPr id="77"'), end = xml.indexOf('</p:sp>', start) + '</p:sp>'.length
  const group = (identity: string, geometry: string, children: string) => `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${identity}" name="Nested ${identity}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>${geometry}</a:xfrm></p:grpSpPr>${children}</p:grpSp>`
  const nested = group("79", '<a:off x="95250" y="190500"/><a:ext cx="3810000" cy="2857500"/><a:chOff x="-95250" y="95250"/><a:chExt cx="1905000" cy="952500"/>', xml.slice(start, end).replace("<p:spPr/>", '<p:spPr><a:xfrm><a:off x="47625" y="142875"/><a:ext cx="952500" cy="476250"/></a:xfrm></p:spPr>'))
  parts.set(part, Buffer.from(xml.slice(0, start) + group("78", '<a:off x="952500" y="476250"/><a:ext cx="5715000" cy="3810000"/><a:chOff x="190500" y="95250"/><a:chExt cx="2857500" cy="1905000"/>', nested) + xml.slice(end)))
  return importPptx(await exportPptx({...source, parts}))
}

export const affineTextShadowXml = '<a:effectLst><a:outerShdw blurRad="60007" dist="310007" dir="7680000" sy="30000" kx="1300200" algn="ctr" rotWithShape="0"><a:prstClr val="black"><a:alpha val="32000"/></a:prstClr></a:outerShdw></a:effectLst>'
export async function shadowTextSource() {
  const source = await retainedTextSource(), parts = new Map(source.parts), part = "ppt/slides/slide1.xml"
  parts.set(part, Buffer.from(parts.get(part)!.toString().replace('<a:sym typeface="Wingdings"', `${affineTextShadowXml}<a:sym typeface="Wingdings"`).replace('type="slidenum"><a:t>42</a:t></a:fld></a:p>', `type="slidenum"><a:t>42</a:t></a:fld><a:endParaRPr>${affineTextShadowXml}</a:endParaRPr></a:p>`)))
  return importPptx(await exportPptx({...source, parts}))
}

export const pairwiseLayers = ["presentation", "category", "master-list", "master-paragraph", "layout-list", "layout-paragraph", "shape-list", "paragraph", "run", "end"]
export async function pairwiseCascadeSource(lower: number, upper: number, noFill = false, noFillAt = upper) {
  const original = await cascadeSource(), parts = new Map(original.parts)
  const properties = (index: number, tag = "defRPr") => index !== lower && index !== upper ? "" : `<a:${tag} sz="${index === upper ? 3000 : 1500}" b="${index === upper ? 0 : 1}" i="${index === upper ? 0 : 1}" u="${index === upper ? "none" : "sng"}">${noFill && index === noFillAt ? "<a:noFill/>" : `<a:solidFill><a:srgbClr val="${index === upper ? "224466" : "aa5500"}"/></a:solidFill>`}<a:latin typeface="${index === upper ? "Winner" : "Loser"}"/></a:${tag}>`
  const list = (index: number) => `<a:lvl1pPr>${properties(index)}</a:lvl1pPr>`
  const replaceBody = (part: string, listIndex: number, paragraphIndex: number) => {
    const document = parseXml(parts.get(part)!), body = document.nodes.filter(node => node.local === "txBody").at(-1)!
    const content = `<p:txBody><a:bodyPr/><a:lstStyle>${list(listIndex)}</a:lstStyle><a:p><a:pPr>${properties(paragraphIndex)}</a:pPr>${listIndex === 6 ? `<a:r>${properties(8, "rPr")}<a:t>Pairwise</a:t></a:r>${properties(9, "endParaRPr")}` : ""}</a:p></p:txBody>`
    parts.set(part, Buffer.from(document.xml.slice(0, body.start) + content + document.xml.slice(body.end)))
  }
  const main = "ppt/presentation.xml", xml = parts.get(main)!.toString(), defaults = `<p:defaultTextStyle>${list(0)}</p:defaultTextStyle>`
  parts.set(main, Buffer.from(xml.includes("<p:defaultTextStyle") ? xml.replace(/<p:defaultTextStyle[\s\S]*?<\/p:defaultTextStyle>/, defaults) : xml.replace("</p:presentation>", defaults + "</p:presentation>")))
  const master = "ppt/slideMasters/slideMaster1.xml"
  parts.set(master, Buffer.from(parts.get(master)!.toString().replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, `<p:bodyStyle>${list(1)}</p:bodyStyle>`)))
  replaceBody(master, 2, 3)
  replaceBody("ppt/slideLayouts/slideLayout1.xml", 4, 5)
  replaceBody("ppt/slides/slide1.xml", 6, 7)
  return importPptx(await exportPptx({...original, parts}))
}
