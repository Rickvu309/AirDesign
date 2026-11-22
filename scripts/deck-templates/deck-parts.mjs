import {
  colorXml,
  declaration,
  escaped,
  levelList,
  namespaces,
  placeholderShape,
  rectangle,
  relationships,
  solid,
  tableTextNamespace,
  tableTextUri,
  textBox,
  textStylesNamespace,
  textStylesUri,
  tree,
} from "./deck-xml.mjs"

const slideSize = 'cx="12192000" cy="6858000"'
const override = "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
const slotNames = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]
const mapped = {
  light: 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"',
  dark: 'bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2"',
}

export const styleNames = [
  ["titleStyle/0", "Title"],
  ["bodyStyle/0", "Body"],
  ["bodyStyle/1", "Body 2"],
  ["otherStyle/1", "Heading"],
  ["otherStyle/2", "Caption"],
  ["otherStyle/3", "Label"],
  ["otherStyle/4", "Big number"],
]

function theme(spec) {
  const font = (typeface) => `<a:latin typeface="${escaped(typeface)}"/><a:ea typeface=""/><a:cs typeface=""/>`
  const slot = (name) => `<a:${name}><a:srgbClr val="${spec.colors[name]}"/></a:${name}>`
  const links = `<a:hlink><a:srgbClr val="${spec.colors.hlink}"/></a:hlink><a:folHlink><a:srgbClr val="${spec.colors.folHlink}"/></a:folHlink>`
  const phFill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  const lines = [6350, 12700, 19050].map(
    (width) => `<a:ln w="${String(width)}">${phFill}<a:prstDash val="solid"/></a:ln>`,
  )
  const format = `<a:fmtScheme name="${escaped(spec.name)}"><a:fillStyleLst>${phFill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${lines.join("")}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${phFill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme>`
  return `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escaped(spec.name)}"><a:themeElements><a:clrScheme name="${escaped(spec.name)}">${slotNames.map(slot).join("")}${links}</a:clrScheme><a:fontScheme name="${escaped(spec.name)}"><a:majorFont>${font(spec.fonts.major)}</a:majorFont><a:minorFont>${font(spec.fonts.minor)}</a:minorFont></a:fontScheme>${format}</a:themeElements></a:theme>`
}

function textStyles(spec) {
  const { scale } = spec
  const plain = { ...scale.body, bullet: undefined }
  const names = styleNames.map(([ref, name]) => `<ad:style ref="${ref}" name="${name}"/>`).join("")
  const extension = `<p:extLst><p:ext uri="${textStylesUri}"><ad:textStyles xmlns:ad="${textStylesNamespace}">${names}</ad:textStyles></p:ext></p:extLst>`
  const styles = `<p:txStyles>${levelList("p:titleStyle", [scale.title])}${levelList("p:bodyStyle", [scale.body, scale.body2, scale.body3])}${levelList("p:otherStyle", [plain, scale.heading, scale.caption, scale.label, scale.bigNumber])}</p:txStyles>`
  return { styles, extension, plain }
}

function tableStyles(spec) {
  const line = (side, width, color) =>
    `<a:${side}><a:ln w="${String(width)}" cmpd="sng"><a:solidFill>${colorXml(color)}</a:solidFill></a:ln></a:${side}>`
  const none = (side) => `<a:${side}><a:ln><a:noFill/></a:ln></a:${side}>`
  const text = (font, bold) =>
    `<a:tcTxStyle b="${bold ? "on" : "off"}"><a:fontRef idx="${font}"><a:prstClr val="black"/></a:fontRef><a:schemeClr val="tx1"/></a:tcTxStyle>`
  const { id, rule, headRule } = spec.table
  const whole = `<a:wholeTbl>${text("minor", false)}<a:tcStyle><a:tcBdr>${["left", "right", "top"].map(none).join("")}${line("bottom", 9525, rule)}${line("insideH", 9525, rule)}${none("insideV")}</a:tcBdr><a:fill><a:noFill/></a:fill></a:tcStyle></a:wholeTbl>`
  const first = `<a:firstRow>${text("major", false)}<a:tcStyle><a:tcBdr>${line("bottom", 12700, headRule)}</a:tcBdr></a:tcStyle></a:firstRow>`
  return `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${id}"><a:tblStyle styleId="${id}" styleName="${escaped(spec.name)}">${whole}${first}<a:extLst><a:ext uri="${tableTextUri}"><ad:cellText xmlns:ad="${tableTextNamespace}" sz="${String(Math.round(spec.scale.body2.size * 100))}"/></a:ext></a:extLst></a:tblStyle></a:tblStyleLst>`
}

function placed(shapes, start = 2) {
  return shapes.map((shape, at) => {
    const id = start + at
    if (shape.kind === "rule") return rectangle(id, shape.name ?? "Rule", shape.box, shape.color)
    if (shape.kind === "text")
      return textBox(id, shape.name ?? "Text", shape.box, shape.lines, shape.style, shape.anchor)
    return placeholderShape(id, shape.ph, shape)
  })
}

function slideShapes(spec, layout, slide) {
  const filled = layout.shapes.flatMap((shape) => {
    if (shape.kind !== undefined || shape.ph.type === "sldNum") return []
    const key = shape.key ?? shape.ph.type
    const lines = slide.text[key]
    return lines === undefined ? [] : [{ ph: shape.ph, lines }]
  })
  const number = layout.shapes.find((shape) => shape.ph?.type === "sldNum")
  const numbered = number === undefined || slide.empty ? [] : [{ ph: number.ph, style: spec.scale.caption }]
  return [...filled, ...numbered, ...(slide.shapes ?? [])]
}

export function deckParts(spec, { start = false } = {}) {
  const parts = new Map()
  const put = (name, text) => parts.set(name, Buffer.from(declaration + text))
  const slides = start ? [{ layout: "Blank", text: {}, empty: true }] : spec.slides
  const layoutIndex = (name) => spec.layouts.findIndex((layout) => layout.name === name) + 1
  const types = [
    ["/ppt/presentation.xml", "presentation.main"],
    ["/ppt/presProps.xml", "presProps"],
    ["/ppt/tableStyles.xml", "tableStyles"],
    ["/ppt/slideMasters/slideMaster1.xml", "slideMaster"],
    ...slides.map((_, n) => [`/ppt/slides/slide${String(n + 1)}.xml`, "slide"]),
    ...spec.layouts.map((_, n) => [`/ppt/slideLayouts/slideLayout${String(n + 1)}.xml`, "slideLayout"]),
  ]
  put(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.map(([name, type]) => `<Override PartName="${name}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.${type}+xml"/>`).join("")}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`,
  )
  put("_rels/.rels", relationships([[1, "officeDocument", "ppt/presentation.xml"]]))
  const { styles, extension, plain } = textStyles(spec)
  const ids = slides.map((_, n) => `<p:sldId id="${String(256 + n)}" r:id="rId${String(n + 2)}"/>`).join("")
  put(
    "ppt/presentation.xml",
    `<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz ${slideSize}/><p:notesSz cx="6858000" cy="9144000"/>${levelList("p:defaultTextStyle", [plain])}</p:presentation>`,
  )
  put(
    "ppt/_rels/presentation.xml.rels",
    relationships([
      [1, "slideMaster", "slideMasters/slideMaster1.xml"],
      ...slides.map((_, n) => [n + 2, "slide", `slides/slide${String(n + 1)}.xml`]),
      [slides.length + 2, "presProps", "presProps.xml"],
      [slides.length + 3, "theme", "theme/theme1.xml"],
      [slides.length + 4, "tableStyles", "tableStyles.xml"],
    ]),
  )
  put("ppt/presProps.xml", `<p:presentationPr ${namespaces}/>`)
  put("ppt/tableStyles.xml", tableStyles(spec))
  put("ppt/theme/theme1.xml", theme(spec))
  const colorMap = `<p:clrMap ${mapped[spec.map]} accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`
  const layoutIds = spec.layouts.map(
    (_, n) => `<p:sldLayoutId id="${String(2147483649 + n)}" r:id="rId${String(n + 1)}"/>`,
  )
  put(
    "ppt/slideMasters/slideMaster1.xml",
    `<p:sldMaster ${namespaces}><p:cSld><p:bg><p:bgPr>${solid("bg1")}<a:effectLst/></p:bgPr></p:bg>${tree(placed(spec.master))}</p:cSld>${colorMap}<p:sldLayoutIdLst>${layoutIds.join("")}</p:sldLayoutIdLst>${styles}${extension}</p:sldMaster>`,
  )
  put(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    relationships([
      ...spec.layouts.map((_, n) => [n + 1, "slideLayout", `../slideLayouts/slideLayout${String(n + 1)}.xml`]),
      [spec.layouts.length + 1, "theme", "../theme/theme1.xml"],
    ]),
  )
  for (const [n, layout] of spec.layouts.entries()) {
    put(
      `ppt/slideLayouts/slideLayout${String(n + 1)}.xml`,
      `<p:sldLayout ${namespaces} type="${layout.type}" preserve="1"><p:cSld name="${escaped(layout.name)}">${tree(placed(layout.shapes))}</p:cSld>${override}</p:sldLayout>`,
    )
    put(
      `ppt/slideLayouts/_rels/slideLayout${String(n + 1)}.xml.rels`,
      relationships([[1, "slideMaster", "../slideMasters/slideMaster1.xml"]]),
    )
  }
  for (const [n, slide] of slides.entries()) {
    const layout = spec.layouts[layoutIndex(slide.layout) - 1]
    put(
      `ppt/slides/slide${String(n + 1)}.xml`,
      `<p:sld ${namespaces}><p:cSld>${tree(placed(slideShapes(spec, layout, slide)))}</p:cSld>${override}</p:sld>`,
    )
    put(
      `ppt/slides/_rels/slide${String(n + 1)}.xml.rels`,
      relationships([[1, "slideLayout", `../slideLayouts/slideLayout${String(layoutIndex(slide.layout))}.xml`]]),
    )
  }
  return parts
}
