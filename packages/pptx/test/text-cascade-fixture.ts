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
