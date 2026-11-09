import {createNativePresentation} from "../src/native.ts"
import {importPptx, exportPptx} from "../src/index.ts"

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
