import path from "node:path"
import { readArchive, writeArchive } from "../archive.ts"
import { parseXml, type XmlNode } from "../xml.ts"
import { copyDependency, hash, type Presentation } from "../index.ts"

const chartUri = "http://schemas.openxmlformats.org/drawingml/2006/chart"
const sheetUri = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
function replaceValues(xml: string, replacements: { node: XmlNode; value: number }[]): Buffer {
  let output = xml
  for (const { node, value } of replacements.sort((a,b) => b.node.openEnd - a.node.openEnd)) output = output.slice(0,node.openEnd) + String(value) + output.slice(node.closeStart)
  return Buffer.from(output)
}
export async function patchChartValues(presentation: Presentation, part: string, seriesIndex: number, values: number[]): Promise<Presentation> {
  if (values.length === 0 || !values.every(Number.isFinite)) throw new Error("finite-chart-values-required")
  const bytes = presentation.parts.get(part)
  if (!bytes) throw new Error("chart-part-required")
  const parsed = parseXml(bytes)
  const series = parsed.nodes.filter(node => node.uri === chartUri && node.local === "ser")[seriesIndex]
  if (!series) throw new Error("chart-series-required")
  const valueNode = parsed.nodes.find(node => node.local === "val" && node.uri === chartUri && node.start > series.start && node.end < series.end)
  if (!valueNode) throw new Error("qualified-chart-values-required")
  const descendants = parsed.nodes.filter(node => node.start > valueNode.start && node.end < valueNode.end)
  const formula = descendants.find(node => node.local === "f")
  const range = formula && /^Sheet1!\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)$/.exec(parsed.xml.slice(formula.openEnd,formula.closeStart))
  const cached = descendants.filter(node => node.uri === chartUri && node.local === "v")
  const indices = descendants.filter(node => node.uri === chartUri && node.local === "pt").map(node => node.attributes.idx)
  if (indices.some((value,index) => value !== String(index))) throw new Error("chart-cache-order-unqualified")
  if (!range || range[1] !== range[3] || !range[2] || !range[4] || Number(range[4])-Number(range[2])+1 !== values.length || cached.length !== values.length) throw new Error("chart-workbook-range-unqualified")
  const relPart = `${path.posix.dirname(part)}/_rels/${path.posix.basename(part)}.rels`
  const relBytes = presentation.parts.get(relPart)
  if (!relBytes) throw new Error("chart-workbook-relationship-required")
  const packageRel = parseXml(relBytes).nodes.find(node => node.local === "Relationship" && node.attributes.Type?.endsWith("/package"))
  const target = packageRel?.attributes.Target
  const id = packageRel?.attributes.Id
  if (!target || !id) throw new Error("chart-workbook-required")
  let workbookPart = path.posix.normalize(path.posix.join(path.posix.dirname(part),target))
  let edited = presentation
  if (presentation.report.relationships.filter(rel => rel.target === workbookPart).length > 1) {
    const destination = workbookPart.replace(/\.xlsx$/, `-edit-${hash(Buffer.from(part)).slice(0,8)}.xlsx`)
    edited = copyDependency(edited,workbookPart,destination,relPart,id)
    workbookPart = destination
  }
  const workbook = edited.parts.get(workbookPart)
  if (!workbook) throw new Error("chart-workbook-missing")
  const sheets = await readArchive(workbook)
  const sheetBytes = sheets.get("xl/worksheets/sheet1.xml")
  const workbookBytes = sheets.get("xl/workbook.xml")
  const sheetNodes = workbookBytes && parseXml(workbookBytes).nodes.filter(node => node.uri === sheetUri && node.local === "sheet")
  const sheetIdentity = sheetNodes?.[0]
  const workbookRels = sheets.get("xl/_rels/workbook.xml.rels")
  const sheetRelationship = workbookRels && parseXml(workbookRels).nodes.find(node => node.local === "Relationship" && node.attributes.Id === sheetIdentity?.attributes["r:id"] && node.attributes.Type?.endsWith("/worksheet"))
  const worksheetTarget = sheetRelationship?.attributes.Target
  if (!sheetBytes || !sheetIdentity || sheetNodes?.length !== 1 || sheetIdentity.attributes.name !== "Sheet1" || !worksheetTarget || path.posix.normalize(path.posix.join("xl",worksheetTarget)) !== "xl/worksheets/sheet1.xml") throw new Error("chart-sheet-unqualified")
  const sheet = parseXml(sheetBytes)
  const replacements: { node: XmlNode; value: number }[] = []
  for (const [index,value] of values.entries()) {
    const cell = sheet.nodes.find(node => node.uri === sheetUri && node.local === "c" && node.attributes.r === `${range[1]}${Number(range[2])+index}`)
    const numberNode = cell && sheet.nodes.find(node => node.uri === sheetUri && node.local === "v" && node.start > cell.start && node.end < cell.end)
    if (!numberNode || cell?.attributes.t === "s") throw new Error("numeric-chart-cell-required")
    replacements.push({ node: numberNode, value })
  }
  sheets.set("xl/worksheets/sheet1.xml",replaceValues(sheet.xml,replacements))
  const parts = new Map(edited.parts)
  parts.set(workbookPart,await writeArchive(sheets))
  parts.set(part,replaceValues(parsed.xml,cached.map((node,index) => {
    const value = values[index]
    if (value === undefined) throw new Error("chart-value-required")
    return { node, value }
  })))
  return { ...edited, parts }
}
