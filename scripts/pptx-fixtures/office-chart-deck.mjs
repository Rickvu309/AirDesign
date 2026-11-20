import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { storedZip } from "../stored-zip.mjs"
import { blankParts } from "./blank-deck.mjs"

const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
const officeRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const chartUri = "http://schemas.openxmlformats.org/drawingml/2006/chart"
const grey =
  '<a:solidFill><a:schemeClr val="tx1"><a:lumMod val="65000"/><a:lumOff val="35000"/></a:schemeClr></a:solidFill>'
const deckFont = '<a:latin typeface="Georgia"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>'
const hairline =
  '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill><a:round/></a:ln>'
const bare = "<a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/>"

export const officeCategories = ["North", "South", "West"]
export const officeSeries = [
  { name: "2024", values: [4.3, 2.5, 3.5] },
  { name: "2025", values: [2.4, 4.4, 1.8] },
]
export const officeCharts = [
  { kind: "bar", shape: "2", title: "Revenue by region", box: [457_200, 1_143_000, 5_486_400, 4_572_000] },
  { kind: "line", shape: "3", title: "Margin by region", box: [6_248_400, 1_143_000, 5_486_400, 4_572_000] },
]

const officeText = (size) =>
  `<c:txPr><a:bodyPr rot="-60000000" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0">${grey}${deckFont}</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`

const cells = (formula, values, numeric) => {
  const points = values.map((value, at) => `<c:pt idx="${at}"><c:v>${value}</c:v></c:pt>`).join("")
  const count = `<c:ptCount val="${values.length}"/>`
  return numeric
    ? `<c:numRef><c:f>${formula}</c:f><c:numCache><c:formatCode>General</c:formatCode>${count}${points}</c:numCache></c:numRef>`
    : `<c:strRef><c:f>${formula}</c:f><c:strCache>${count}${points}</c:strCache></c:strRef>`
}

const uniqueId = (at, chart) =>
  `<c:extLst><c:ext uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://schemas.microsoft.com/office/drawing/2014/chart"><c16:uniqueId val="{0000000${at}-6F1D-4C55-9A1B-0C1D2E3F4A5${chart}}"/></c:ext></c:extLst>`

const seriesXml = (kind, at, chart) => {
  const series = officeSeries[at]
  const column = String.fromCharCode(66 + at)
  const accent = `<a:solidFill><a:schemeClr val="accent${at + 1}"/></a:solidFill>`
  const look =
    kind === "bar"
      ? `<c:spPr>${accent}<a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr><c:invertIfNegative val="0"/>`
      : `<c:spPr><a:ln w="28575" cap="rnd">${accent}<a:round/></a:ln><a:effectLst/></c:spPr><c:marker><c:symbol val="none"/></c:marker>`
  const data = `<c:cat>${cells("Sheet1!$A$2:$A$4", officeCategories, false)}</c:cat><c:val>${cells(`Sheet1!$${column}$2:$${column}$4`, series.values, true)}</c:val>`
  const tail = kind === "line" ? '<c:smooth val="0"/>' : ""
  return `<c:ser><c:idx val="${at}"/><c:order val="${at}"/><c:tx>${cells(`Sheet1!$${column}$1`, [series.name], false)}</c:tx>${look}${data}${tail}${uniqueId(at, chart)}</c:ser>`
}

const axes = () =>
  `<c:catAx><c:axId val="501"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:noFill/>${hairline}<a:effectLst/></c:spPr>${officeText(1197)}<c:crossAx val="502"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
  `<c:valAx><c:axId val="502"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr>${hairline}<a:effectLst/></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${bare}</c:spPr>${officeText(1197)}<c:crossAx val="501"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`

const noLabels =
  '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>'

const group = (kind, chart) => {
  const series = officeSeries.map((_, at) => seriesXml(kind, at, chart)).join("")
  const ids = '<c:axId val="501"/><c:axId val="502"/>'
  return kind === "bar"
    ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}${noLabels}<c:gapWidth val="219"/><c:overlap val="-27"/>${ids}</c:barChart>`
    : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}${noLabels}<c:marker val="1"/>${ids}</c:lineChart>`
}

export const officeChartXml = ({ kind, title }, chart) =>
  `${declaration}<c:chartSpace xmlns:c="${chartUri}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRelationships}" xmlns:c16r2="http://schemas.microsoft.com/office/drawing/2015/06/chart"><c:date1904 val="0"/><c:lang val="en-US"/><c:roundedCorners val="0"/><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="c14" xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart"><c14:style val="102"/></mc:Choice><mc:Fallback><c:style val="2"/></mc:Fallback></mc:AlternateContent>` +
  `<c:chart><c:title><c:tx><c:rich><a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1862" b="0" i="0" u="none" strike="noStrike" kern="1200" spc="0" baseline="0">${grey}${deckFont}</a:defRPr></a:pPr><a:r><a:rPr lang="en-US"/><a:t>${title}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/><c:spPr>${bare}</c:spPr></c:title><c:autoTitleDeleted val="0"/>` +
  `<c:plotArea><c:layout/>${group(kind, chart)}${axes()}<c:spPr>${bare}</c:spPr></c:plotArea>` +
  `<c:legend><c:legendPos val="b"/><c:overlay val="0"/><c:spPr>${bare}</c:spPr>${officeText(1197)}</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
  `<c:spPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="25000"/><a:lumOff val="75000"/></a:schemeClr></a:solidFill><a:round/></a:ln><a:effectLst/></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr>${deckFont}</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:externalData r:id="rId3"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`

const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const sheetType = "application/vnd.openxmlformats-officedocument.spreadsheetml"
const strings = [" ", ...officeSeries.map((series) => series.name), ...officeCategories]
const letter = (at) => String.fromCharCode(65 + at)

const relationships = (rows) =>
  `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows
    .map(([id, type, target]) => `<Relationship Id="rId${id}" Type="${type}" Target="${target}"/>`)
    .join("")}</Relationships>`

const sheetXml = () => {
  const shared = (text) => strings.indexOf(text)
  const header = [" ", ...officeSeries.map((series) => series.name)]
    .map((text, at) => `<c r="${letter(at)}1" t="s"><v>${shared(text)}</v></c>`)
    .join("")
  const rows = officeCategories
    .map((category, point) => {
      const row = point + 2
      const values = officeSeries
        .map((series, at) => `<c r="${letter(at + 1)}${row}" s="1"><v>${series.values[point]}</v></c>`)
        .join("")
      return `<row r="${row}" spans="1:3"><c r="A${row}" t="s"><v>${shared(category)}</v></c>${values}</row>`
    })
    .join("")
  return `${declaration}<worksheet xmlns="${spreadsheet}" xmlns:r="${officeRelationships}"><dimension ref="A1:C4"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData><row r="1" spans="1:3">${header}</row>${rows}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`
}

const styles = `${declaration}<styleSheet xmlns="${spreadsheet}"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const table = `${declaration}<table xmlns="${spreadsheet}" id="1" name="Table1" displayName="Table1" ref="A1:C4" totalsRowShown="0"><autoFilter ref="A1:C4"/><tableColumns count="3"><tableColumn id="1" name=" "/><tableColumn id="2" name="2024"/><tableColumn id="3" name="2025"/></tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`

export const officeWorkbook = () =>
  storedZip(
    new Map(
      [
        [
          "[Content_Types].xml",
          `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${sheetType}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheetType}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${sheetType}.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="${sheetType}.sharedStrings+xml"/><Override PartName="/xl/tables/table1.xml" ContentType="${sheetType}.table+xml"/></Types>`,
        ],
        ["_rels/.rels", relationships([[1, `${officeRelationships}/officeDocument`, "xl/workbook.xml"]])],
        [
          "xl/workbook.xml",
          `${declaration}<workbook xmlns="${spreadsheet}" xmlns:r="${officeRelationships}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        ],
        [
          "xl/_rels/workbook.xml.rels",
          relationships([
            [1, `${officeRelationships}/worksheet`, "worksheets/sheet1.xml"],
            [2, `${officeRelationships}/styles`, "styles.xml"],
            [3, `${officeRelationships}/sharedStrings`, "sharedStrings.xml"],
          ]),
        ],
        ["xl/worksheets/sheet1.xml", sheetXml()],
        [
          "xl/worksheets/_rels/sheet1.xml.rels",
          relationships([[1, `${officeRelationships}/table`, "../tables/table1.xml"]]),
        ],
        ["xl/tables/table1.xml", table],
        [
          "xl/sharedStrings.xml",
          `${declaration}<sst xmlns="${spreadsheet}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((text) => `<si><t xml:space="preserve">${text}</t></si>`).join("")}</sst>`,
        ],
        ["xl/styles.xml", styles],
      ].map(([name, text]) => [name, Buffer.from(text)]),
    ),
  )

const frame = ({ shape, box: [x, y, cx, cy] }, at) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${shape}" name="Chart ${shape}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm><a:graphic><a:graphicData uri="${chartUri}"><c:chart xmlns:c="${chartUri}" r:id="rId${at + 2}"/></a:graphicData></a:graphic></p:graphicFrame>`

export function officeChartParts() {
  const parts = blankParts({ empty: true })
  const slide = parts.get("ppt/slides/slide1.xml").toString()
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(slide.replace("</p:spTree>", `${officeCharts.map(frame).join("")}</p:spTree>`)),
  )
  const rels = parts.get("ppt/slides/_rels/slide1.xml.rels").toString()
  const chartType = `${officeRelationships}/chart`
  parts.set(
    "ppt/slides/_rels/slide1.xml.rels",
    Buffer.from(
      rels.replace(
        "</Relationships>",
        `${officeCharts.map((_, at) => `<Relationship Id="rId${at + 2}" Type="${chartType}" Target="../charts/chart${at + 1}.xml"/>`).join("")}</Relationships>`,
      ),
    ),
  )
  const types = parts.get("[Content_Types].xml").toString()
  const charts = officeCharts
    .map(
      (_, at) =>
        `<Override PartName="/ppt/charts/chart${at + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    )
    .join("")
  parts.set(
    "[Content_Types].xml",
    Buffer.from(
      types.replace("</Types>", `<Default Extension="xlsx" ContentType="${sheetType}.sheet"/>${charts}</Types>`),
    ),
  )
  for (const [at, chart] of officeCharts.entries()) {
    parts.set(`ppt/charts/chart${at + 1}.xml`, Buffer.from(officeChartXml(chart, at)))
    parts.set(
      `ppt/charts/_rels/chart${at + 1}.xml.rels`,
      Buffer.from(
        relationships([[3, `${officeRelationships}/package`, `../embeddings/Microsoft_Excel_Worksheet${at + 1}.xlsx`]]),
      ),
    )
    parts.set(`ppt/embeddings/Microsoft_Excel_Worksheet${at + 1}.xlsx`, officeWorkbook())
  }
  return parts
}

export const officeChartDeck = () => storedZip(officeChartParts())

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL("office-chart.pptx", import.meta.url), officeChartDeck())
}
