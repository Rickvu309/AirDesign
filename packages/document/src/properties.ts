function route<const Name extends string>(name: Name): { readonly route: Name } {
  return { route: name }
}

const presentationSize = route("presentation.size")
const themeColors = route("theme.colors")
const themeFonts = route("theme.fonts")
const cSldBg = route("cSld.bg")
const cNvPrName = route("cNvPr.name")
const sectionTitle = route("section.title")
const notesBody = route("notes.body")
const sldShow = route("sld.show")
const slideLayoutRel = route("slide.layoutRel")
const xfrm = route("xfrm")
const prstGeom = route("prstGeom")
const spPrFill = route("spPr.fill")
const ln = route("ln")
const effectLst = route("effectLst")
const txBody = route("txBody")
const bodyPr = route("bodyPr")
const nvPrPh = route("nvPr.ph")
const airdesignRole = route("airdesign.role")
const cNvPrDescr = route("cNvPr.descr")
const blipEmbed = route("blip.embed")
const srcRect = route("srcRect")
const childSpace = route("grpSpPr.chXfrm")
const tblGrid = route("tblGrid")
const tblPrStyle = route("tblPr.style")
const trHeight = route("tr.h")
const tcPrFill = route("tcPr.fill")
const tcPrBorders = route("tcPr.borders")
const tcSpan = route("tc.span")
const chartData = route("chart.data")
const chartType = route("chart.type")
const chartTitle = route("chart.title")
const chartLegend = route("chart.legend")
const chartAxes = route("chart.axes")
const chartSeries = route("chart.seriesStyle")

export const kinds = [
  "deck",
  "theme",
  "master",
  "layout",
  "section",
  "slide",
  "shape",
  "picture",
  "connector",
  "group",
  "table",
  "row",
  "cell",
  "chart",
  "kept",
] as const

export type Kind = (typeof kinds)[number]

type NamedRoute<Name extends string> = {
  readonly route: Name
}

type PropertyRoutes = {
  readonly deck: {
    readonly size: NamedRoute<"presentation.size">
  }
  readonly theme: {
    readonly colors: NamedRoute<"theme.colors">
    readonly fonts: NamedRoute<"theme.fonts">
  }
  readonly master: {
    readonly background: NamedRoute<"cSld.bg">
  }
  readonly layout: {
    readonly background: NamedRoute<"cSld.bg">
    readonly name: NamedRoute<"cNvPr.name">
  }
  readonly section: {
    readonly title: NamedRoute<"section.title">
  }
  readonly slide: {
    readonly background: NamedRoute<"cSld.bg">
    readonly notes: NamedRoute<"notes.body">
    readonly hidden: NamedRoute<"sld.show">
    readonly layout: NamedRoute<"slide.layoutRel">
  }
  readonly shape: {
    readonly box: NamedRoute<"xfrm">
    readonly geometry: NamedRoute<"prstGeom">
    readonly fill: NamedRoute<"spPr.fill">
    readonly line: NamedRoute<"ln">
    readonly effects: NamedRoute<"effectLst">
    readonly text: NamedRoute<"txBody">
    readonly body: NamedRoute<"bodyPr">
    readonly placeholder: NamedRoute<"nvPr.ph">
    readonly role: NamedRoute<"airdesign.role">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
  readonly picture: {
    readonly box: NamedRoute<"xfrm">
    readonly asset: NamedRoute<"blip.embed">
    readonly crop: NamedRoute<"srcRect">
    readonly line: NamedRoute<"ln">
    readonly role: NamedRoute<"airdesign.role">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
  readonly connector: {
    readonly box: NamedRoute<"xfrm">
    readonly line: NamedRoute<"ln">
    readonly geometry: NamedRoute<"prstGeom">
    readonly name: NamedRoute<"cNvPr.name">
  }
  readonly group: {
    readonly box: NamedRoute<"xfrm">
    readonly children: NamedRoute<"grpSpPr.chXfrm">
    readonly role: NamedRoute<"airdesign.role">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
  readonly table: {
    readonly box: NamedRoute<"xfrm">
    readonly columns: NamedRoute<"tblGrid">
    readonly style: NamedRoute<"tblPr.style">
    readonly role: NamedRoute<"airdesign.role">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
  readonly row: {
    readonly height: NamedRoute<"tr.h">
  }
  readonly cell: {
    readonly text: NamedRoute<"txBody">
    readonly fill: NamedRoute<"tcPr.fill">
    readonly borders: NamedRoute<"tcPr.borders">
    readonly span: NamedRoute<"tc.span">
  }
  readonly chart: {
    readonly box: NamedRoute<"xfrm">
    readonly data: NamedRoute<"chart.data">
    readonly type: NamedRoute<"chart.type">
    readonly title: NamedRoute<"chart.title">
    readonly legend: NamedRoute<"chart.legend">
    readonly axes: NamedRoute<"chart.axes">
    readonly series: NamedRoute<"chart.seriesStyle">
    readonly role: NamedRoute<"airdesign.role">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
  readonly kept: {
    readonly box: NamedRoute<"xfrm">
    readonly name: NamedRoute<"cNvPr.name">
    readonly alt: NamedRoute<"cNvPr.descr">
  }
}

type Covered = keyof PropertyRoutes extends Kind ? (Kind extends keyof PropertyRoutes ? PropertyRoutes : never) : never

export const properties = {
  deck: { size: presentationSize },
  theme: { colors: themeColors, fonts: themeFonts },
  master: { background: cSldBg },
  layout: { background: cSldBg, name: cNvPrName },
  section: { title: sectionTitle },
  slide: { background: cSldBg, notes: notesBody, hidden: sldShow, layout: slideLayoutRel },
  shape: {
    box: xfrm,
    geometry: prstGeom,
    fill: spPrFill,
    line: ln,
    effects: effectLst,
    text: txBody,
    body: bodyPr,
    placeholder: nvPrPh,
    role: airdesignRole,
    name: cNvPrName,
    alt: cNvPrDescr,
  },
  picture: {
    box: xfrm,
    asset: blipEmbed,
    crop: srcRect,
    line: ln,
    role: airdesignRole,
    name: cNvPrName,
    alt: cNvPrDescr,
  },
  connector: { box: xfrm, line: ln, geometry: prstGeom, name: cNvPrName },
  group: { box: xfrm, children: childSpace, role: airdesignRole, name: cNvPrName, alt: cNvPrDescr },
  table: {
    box: xfrm,
    columns: tblGrid,
    style: tblPrStyle,
    role: airdesignRole,
    name: cNvPrName,
    alt: cNvPrDescr,
  },
  row: { height: trHeight },
  cell: { text: txBody, fill: tcPrFill, borders: tcPrBorders, span: tcSpan },
  chart: {
    box: xfrm,
    data: chartData,
    type: chartType,
    title: chartTitle,
    legend: chartLegend,
    axes: chartAxes,
    series: chartSeries,
    role: airdesignRole,
    name: cNvPrName,
    alt: cNvPrDescr,
  },
  kept: { box: xfrm, name: cNvPrName, alt: cNvPrDescr },
} as const satisfies Covered

type PropertyTable = typeof properties

export type ExportRoute = {
  [KindName in keyof PropertyTable]: PropertyTable[KindName][keyof PropertyTable[KindName]] extends {
    readonly route: infer Name
  }
    ? Name
    : never
}[keyof PropertyTable]
