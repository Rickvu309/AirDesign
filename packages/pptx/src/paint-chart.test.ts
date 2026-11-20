import { beforeAll, describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const slide = "ppt/slides/slide19.xml"
const chartPart = "ppt/charts/chart3.xml"
const colorsPart = "ppt/charts/colors3.xml"

const relationships = (rows: readonly (readonly [string, string, string])[]) =>
  `<Relationships>${rows.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`

const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Chart 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="1690688"/><a:ext cx="4398818" cy="3976687"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId3"/></a:graphicData></a:graphic></p:graphicFrame>`

const themeXml = `<a:theme><a:themeElements><a:clrScheme name="Contoso v1"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="2C567A"/></a:accent1><a:accent2><a:srgbClr val="0072C7"/></a:accent2><a:accent3><a:srgbClr val="0D1D51"/></a:accent3></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme><a:fillStyleLst/><a:lnStyleLst/></a:fmtScheme></a:themeElements></a:theme>`

const colorsXml = `<cs:colorStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" meth="cycle" id="10"><a:schemeClr val="accent1"/><a:schemeClr val="accent2"/><a:schemeClr val="accent3"/><cs:variation/><cs:variation><a:lumMod val="60000"/></cs:variation></cs:colorStyle>`

const look = (size: number, mod: number, off: number) =>
  `<a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="${mod}"/><a:lumOff val="${off}"/></a:schemeClr></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p>`

const point = (at: number, accent: number) =>
  `<c:dPt><c:idx val="${at}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:schemeClr val="accent${accent}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln><a:effectLst/></c:spPr></c:dPt>`

const strings = (reference: string, texts: readonly string[]) =>
  `<c:strRef><c:f>${reference}</c:f><c:strCache><c:ptCount val="${texts.length}"/>${texts.map((text, at) => `<c:pt idx="${at}"><c:v>${text}</c:v></c:pt>`).join("")}</c:strCache></c:strRef>`

const numbers = (format: string, values: readonly (number | null)[]) =>
  `<c:numRef><c:f>Sheet1!$B$2:$B$4</c:f><c:numCache><c:formatCode>${format}</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, at) => (value === null ? "" : `<c:pt idx="${at}"><c:v>${value}</c:v></c:pt>`)).join("")}</c:numCache></c:numRef>`

const tenureLabels = `<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr>${look(1197, 75000, 25000)}</c:txPr><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="1"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>`

const tenure = `<c:title><c:overlay val="0"/><c:txPr>${look(1862, 65000, 35000)}</c:txPr></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strings("Sheet1!$B$1", ["Housing Tenure Status"])}</c:tx>${point(0, 1)}${point(1, 2)}${point(2, 3)}${tenureLabels}<c:cat>${strings("Sheet1!$A$2:$A$4", ["Owner with mortgage", "Owner, no mortgage", "Renter"])}</c:cat><c:val>${numbers("0%", [0.2483663, 0.1549955, 0.5966382])}</c:val></c:ser><c:firstSliceAng val="0"/></c:pieChart></c:plotArea><c:plotVisOnly val="1"/>`

const impactLabels = `<c:dLbls><c:dLbl><c:idx val="1"/><c:layout><c:manualLayout><c:x val="3.4154195493891162E-2"/><c:y val="0"/></c:manualLayout></c:layout><c:dLblPos val="bestFit"/><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbl><c:txPr>${look(1197, 75000, 25000)}</c:txPr><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>`

const impact = `<c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strings("Sheet1!$B$1", ["Share of people"])}</c:tx>${point(0, 1)}${point(1, 2)}${impactLabels}<c:cat>${strings("Sheet1!$A$2:$A$3", ["No Change", "Change in Unit"])}</c:cat><c:val>${numbers("General", [96, 4])}</c:val></c:ser><c:firstSliceAng val="0"/></c:pieChart></c:plotArea>`

const axes = (category = "", value = "") =>
  `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/>${category}</c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/>${value}</c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:crossAx val="1"/></c:valAx>`

const plainSeries = (at: number, name: string, values: readonly (number | null)[], extra = "") =>
  `<c:ser><c:idx val="${at}"/><c:order val="${at}"/><c:tx>${strings("Sheet1!$B$1", [name])}</c:tx>${extra}<c:cat>${strings("Sheet1!$A$2:$A$3", ["2023", "2024"])}</c:cat><c:val>${numbers("General", values)}</c:val></c:ser>`

const bars = (direction: string, grouping: string, more = "") =>
  `<c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="${direction}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${plainSeries(0, "North", [3, 5])}${plainSeries(1, "South", [4, 7])}<c:gapWidth val="219"/>${grouping === "clustered" ? "" : '<c:overlap val="100"/>'}<c:axId val="1"/><c:axId val="2"/></c:barChart>${axes()}${more}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>`

const lineSeriesLook = `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>`

const lines = `<c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${plainSeries(0, "Visits", [1, null], lineSeriesLook)}<c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:lineChart>${axes()}</c:plotArea>`

const space = (chart: string, style = "", outside = "") =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${office}"><c:roundedCorners val="0"/>${style}<c:chart>${chart}</c:chart><c:spPr><a:noFill/><a:ln><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></c:spPr>${outside}<c:externalData r:id="rId3"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`

const partsOf = (chart: string, colors: boolean = true) =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${frame}</p:spTree></p:cSld></p:sld>`)],
    [
      "ppt/slides/_rels/slide19.xml.rels",
      encodeUtf8(
        relationships([
          ["rId3", `${office}/chart`, "../charts/chart3.xml"],
          ["rId1", `${office}/slideLayout`, "../slideLayouts/slideLayout11.xml"],
        ]),
      ),
    ],
    ["ppt/slideLayouts/slideLayout11.xml", encodeUtf8("<p:sldLayout><p:cSld><p:spTree/></p:cSld></p:sldLayout>")],
    [
      "ppt/slideLayouts/_rels/slideLayout11.xml.rels",
      encodeUtf8(relationships([["rId1", `${office}/slideMaster`, "../slideMasters/slideMaster1.xml"]])),
    ],
    [
      "ppt/slideMasters/slideMaster1.xml",
      encodeUtf8('<p:sldMaster><p:cSld><p:spTree/></p:cSld><p:clrMap bg1="lt1" tx1="dk1"/></p:sldMaster>'),
    ],
    [
      "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      encodeUtf8(relationships([["rId1", `${office}/theme`, "../theme/theme1.xml"]])),
    ],
    ["ppt/theme/theme1.xml", encodeUtf8(themeXml)],
    [chartPart, encodeUtf8(chart)],
    [
      "ppt/charts/_rels/chart3.xml.rels",
      encodeUtf8(
        relationships(
          colors
            ? [
                ["rId3", `${office}/package`, "../embeddings/Microsoft_Excel_Worksheet2.xlsx"],
                ["rId2", "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle", "colors3.xml"],
              ]
            : [["rId3", `${office}/package`, "../embeddings/Microsoft_Excel_Worksheet2.xlsx"]],
        ),
      ),
    ],
    [colorsPart, encodeUtf8(colorsXml)],
  ])

const chartIn = (parts: ReadonlyMap<string, Uint8Array>) =>
  paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.kind === "p:graphicFrame")?.chart

const hexes = (colors: readonly ({ readonly hex: string } | null)[]) => colors.map((color) => color?.hex ?? null)

describe("a pie chart cut from census slide 19", () => {
  let chart: ReturnType<typeof chartIn>
  beforeAll(() => {
    chart = chartIn(partsOf(space(tenure)))
  })

  it("reads the type, the categories and the cached values", () => {
    expect(chart?.kind).toBe("pie")
    expect(chart?.categories).toEqual(["Owner with mortgage", "Owner, no mortgage", "Renter"])
    expect(chart?.series.map((series) => series.values)).toEqual([[0.2483663, 0.1549955, 0.5966382]])
    expect(chart?.valueAxis).toBeNull()
  })

  it("resolves each slice's theme colour and its white edge", () => {
    expect(hexes(chart?.series[0]?.points.map((item) => item.fill) ?? [])).toEqual(["2C567A", "0072C7", "0D1D51"])
    expect(chart?.series[0]?.points[0]?.line).toEqual({ color: { hex: "FFFFFF", alpha: 1 }, width: 1.5 })
  })

  it("titles the chart with its one series' name when the title holds no words", () => {
    expect(chart?.title?.text).toBe("Housing Tenure Status")
    expect(chart?.title?.look).toEqual({
      size: 18.62,
      bold: false,
      color: { hex: "595959", alpha: 1 },
      font: "Calibri",
    })
  })

  it("writes each label from its category and its value in the cached format", () => {
    expect(chart?.series[0]?.labels.map((label) => label?.text)).toEqual([
      "Owner with mortgage; 25%",
      "Owner, no mortgage; 15%",
      "Renter; 60%",
    ])
    expect(chart?.series[0]?.labels[0]?.position).toBe("outsideEnd")
    expect(chart?.series[0]?.labels[0]?.look.size).toBe(11.97)
    expect(chart?.series[0]?.labels[0]?.look.color?.hex).toBe("404040")
  })

  it("keeps the chart's own border and has no legend", () => {
    expect(chart?.line).toEqual({ color: { hex: "2C567A", alpha: 1 }, width: 0.75 })
    expect(chart?.legend).toBeNull()
  })
})

it("drops a deleted title and lets one point's label override the series' labels", () => {
  const chart = chartIn(partsOf(space(impact)))
  expect(chart?.title).toBeNull()
  const labels = chart?.series[0]?.labels
  expect(labels?.map((label) => label?.text)).toEqual(["No Change\n96%", "Change in Unit\n4%"])
  expect(labels?.[1]?.dx).toBeCloseTo(0.0342, 4)
  expect(labels?.[0]?.dx).toBe(0)
})

it("reads clustered columns with theme colours from the colour cycle, gridlines and a round axis", () => {
  const chart = chartIn(partsOf(space(bars("col", "clustered")), false))
  expect(chart?.kind).toBe("column")
  expect(chart?.grouping).toBe("clustered")
  expect(chart?.gap).toBeCloseTo(2.19, 6)
  expect(chart?.overlap).toBe(0)
  expect(chart?.series.map((series) => series.name)).toEqual(["North", "South"])
  expect(chart?.series.map((series) => series.points[0]?.fill?.hex)).toEqual(["2C567A", "0072C7"])
  expect(chart?.valueAxis?.ticks.map((tick) => tick.text)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"])
  expect(chart?.valueAxis?.gridlines?.color.hex).toBe("D9D9D9")
  expect(chart?.valueAxis?.line).toBeNull()
  expect(chart?.categoryAxis?.shown).toBe(true)
  expect(chart?.legend?.position).toBe("bottom")
  expect(chart?.legend?.entries.map((entry) => [entry.text, entry.mark.fill?.hex])).toEqual([
    ["North", "2C567A"],
    ["South", "0072C7"],
  ])
})

it("reads a label format whose quoted words the file escapes, as PowerPoint writes them", () => {
  const signed = bars("col", "clustered").replace(
    "<c:gapWidth",
    '<c:dLbls><c:numFmt formatCode="&quot;+&quot;0&quot; pts&quot;" sourceLinked="0"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:gapWidth',
  )
  const chart = chartIn(partsOf(space(signed)))
  expect(chart?.series[0]?.labels.map((label) => label?.text)).toEqual(["+3 pts", "+5 pts"])
})

it("reads stacked bars and scales the axis to each category's total", () => {
  const chart = chartIn(partsOf(space(bars("bar", "stacked"))))
  expect(chart?.kind).toBe("bar")
  expect(chart?.grouping).toBe("stacked")
  expect(chart?.overlap).toBe(1)
  expect(chart?.valueAxis?.max).toBe(12)
  expect(chart?.valueAxis?.ticks.map((tick) => tick.value)).toEqual([0, 2, 4, 6, 8, 10, 12])
})

it("reads a line's own stroke, its gap and no markers", () => {
  const chart = chartIn(partsOf(space(lines)))
  const series = chart?.series[0]
  expect(chart?.kind).toBe("line")
  expect(series?.values).toEqual([1, null])
  expect(series?.stroke).toEqual({ color: { hex: "0072C7", alpha: 1 }, width: 2.25 })
  expect(series?.marker).toBe(false)
})

describe("keeps the box for what it cannot paint truthfully", () => {
  const swap = (chart: string, from: string, to: string) => {
    if (!chart.includes(from)) throw new Error(from)
    return chart.replace(from, to)
  }
  const cases: readonly (readonly [string, string, boolean?])[] = [
    ["a scatter chart", swap(lines, "c:lineChart", "c:scatterChart").replace("</c:lineChart>", "</c:scatterChart>")],
    ["a 3D pie", swap(tenure, "<c:pieChart>", "<c:pie3DChart>").replace("</c:pieChart>", "</c:pie3DChart>")],
    [
      "two chart types in one plot",
      swap(
        bars("col", "clustered"),
        "</c:barChart>",
        `</c:barChart>${lines.slice(lines.indexOf("<c:lineChart>"), lines.indexOf("</c:lineChart>"))}</c:lineChart>`,
      ),
    ],
    [
      "values with no cached numbers",
      swap(tenure, "<c:numCache>", "<c:numCacheGone>").replace("</c:numCache>", "</c:numCacheGone>"),
    ],
    [
      "a value format it cannot write",
      swap(tenure, "<c:formatCode>0%</c:formatCode>", "<c:formatCode>m/d/yyyy</c:formatCode>"),
    ],
    [
      "a log value axis",
      bars("col", "clustered").replace(
        '<c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>',
        '<c:orientation val="minMax"/><c:logBase val="10"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>',
      ),
    ],
    [
      "a reversed category axis",
      swap(bars("bar", "clustered"), '<c:orientation val="minMax"/>', '<c:orientation val="maxMin"/>'),
    ],
    [
      "a label with its own words",
      swap(
        impact,
        '<c:dLbl><c:idx val="1"/>',
        '<c:dLbl><c:idx val="1"/><c:tx><c:rich><a:p><a:r><a:t>Mine</a:t></a:r></a:p></c:rich></c:tx>',
      ),
    ],
    ["a trendline", swap(lines, "<c:marker><c:symbol", "<c:trendline/><c:marker><c:symbol")],
    ["an old chart style with no colour part and no series colours", bars("col", "clustered"), false],
  ]
  for (const [name, chart, colors] of cases) {
    it(name, () => {
      const style = name.startsWith("an old chart style") ? '<c:style val="10"/>' : ""
      expect(chartIn(partsOf(space(chart, style), colors ?? true))).toBeUndefined()
    })
  }
})

it("reads without changing any part", () => {
  const parts = partsOf(space(tenure))
  const before = new Map([...parts].map(([name, bytes]) => [name, Uint8Array.from(bytes)]))
  chartIn(parts)
  expect(parts).toEqual(before)
})
