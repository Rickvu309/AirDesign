const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

export const namespaces = `xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"`
export const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
export const drawingNamespace = a
export const relationshipNamespace = r
export const textStylesUri = "{6E3B1F4A-9C2D-4B7E-A815-3F0D2C9B7A61}"
export const textStylesNamespace = "https://airdesign.app/2026/text-styles"
export const tableTextUri = "{9B4E2A71-3C5D-4F86-A1B0-6D2E8F4C7A53}"
export const tableTextNamespace = "https://airdesign.app/2026/table-text"

const emuPerPoint = 12_700

export const emu = (points) => Math.round(points * emuPerPoint)

export const escaped = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

export function colorXml(color) {
  const [base, ...steps] = color.split(" ")
  const tag = /^[0-9A-F]{6}$/.test(base) ? `a:srgbClr val="${base}"` : `a:schemeClr val="${base}"`
  const transforms = []
  for (let at = 0; at < steps.length; at += 2) transforms.push(`<a:${steps[at]} val="${steps[at + 1]}"/>`)
  const name = tag.split(" ")[0]
  return transforms.length === 0 ? `<${tag}/>` : `<${tag}>${transforms.join("")}</${name}>`
}

export const solid = (color) => `<a:solidFill>${colorXml(color)}</a:solidFill>`

export function runProperties(style, tag = "a:rPr") {
  const attributes = [
    'lang="en-US"',
    `sz="${String(Math.round(style.size * 100))}"`,
    ...(style.bold ? ['b="1"'] : []),
    ...(style.tracking ? [`spc="${String(Math.round(style.tracking * 100))}"`] : []),
    ...(style.caps ? ['cap="all"'] : []),
  ]
  const font = `<a:latin typeface="${escaped(style.font)}"/>`
  return `<${tag} ${attributes.join(" ")}>${solid(style.color)}${font}</${tag}>`
}

export function paragraphProperties(style, level = 0, tag = "a:pPr") {
  const bullet = style.bullet
  const attributes = [
    ...(tag === "a:pPr" && level > 0 ? [`lvl="${String(level)}"`] : []),
    ...(bullet
      ? [`marL="${String(emu(bullet.indent))}"`, `indent="${String(-emu(bullet.hang))}"`]
      : ['marL="0"', 'indent="0"']),
    `algn="${style.align ?? "l"}"`,
  ]
  const spacing = [
    `<a:lnSpc><a:spcPct val="${String(Math.round((style.lineHeight ?? 1) * 100_000))}"/></a:lnSpc>`,
    `<a:spcBef><a:spcPts val="${String(Math.round((style.before ?? 0) * 100))}"/></a:spcBef>`,
    `<a:spcAft><a:spcPts val="${String(Math.round((style.after ?? 0) * 100))}"/></a:spcAft>`,
  ].join("")
  const marker = bullet
    ? `<a:buClr>${colorXml(bullet.color)}</a:buClr><a:buFont typeface="Arial"/><a:buChar char="${bullet.char}"/>`
    : "<a:buNone/>"
  return `<${tag} ${attributes.join(" ")}>${spacing}${marker}${runProperties(style, "a:defRPr")}</${tag}>`
}

export const levelList = (tag, styles) =>
  `<${tag}>${styles.map((style, level) => paragraphProperties(style, level, `a:lvl${String(level + 1)}pPr`)).join("")}</${tag}>`

export function relationships(items) {
  const rows = items.map(
    ([id, type, target]) => `<Relationship Id="rId${String(id)}" Type="${r}/${type}" Target="${target}"/>`,
  )
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows.join("")}</Relationships>`
}

export const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

const inset = { side: 7.2, top: 3.6 }

export const padded = ([x, y, w, h]) => [x - inset.side, y - inset.top, w + 2 * inset.side, h + 2 * inset.top]

const insets = `lIns="${String(emu(inset.side))}" tIns="${String(emu(inset.top))}" rIns="${String(emu(inset.side))}" bIns="${String(emu(inset.top))}"`

export const frame = ([x, y, w, h]) =>
  `<a:xfrm><a:off x="${String(emu(x))}" y="${String(emu(y))}"/><a:ext cx="${String(emu(w))}" cy="${String(emu(h))}"/></a:xfrm>`

export function paragraphs(lines, style) {
  if (lines.length === 0) return `<a:p><a:endParaRPr lang="en-US"/></a:p>`
  return lines
    .map((line) => {
      const { text, level = 0 } = typeof line === "string" ? { text: line } : line
      const pPr =
        style === undefined ? (level > 0 ? `<a:pPr lvl="${String(level)}"/>` : "") : paragraphProperties(style, level)
      const rPr = style === undefined ? '<a:rPr lang="en-US"/>' : runProperties(style)
      return `<a:p>${pPr}<a:r>${rPr}<a:t>${escaped(text)}</a:t></a:r></a:p>`
    })
    .join("")
}

export function placeholderShape(id, ph, { box, prompt, lines, body = {}, style }) {
  const index = ph.index === undefined ? "" : ` idx="${String(ph.index)}"`
  const kind = ph.type === "obj" ? "" : ` type="${ph.type}"`
  const custom = prompt === undefined ? "" : ' hasCustomPrompt="1"'
  const name = `${ph.name ?? ph.type} ${String(id)}`
  const anchor = body.anchor === undefined ? "" : ` anchor="${body.anchor}"`
  const list =
    style === undefined ? "<a:lstStyle/>" : `<a:lstStyle>${paragraphProperties(style, 0, "a:lvl1pPr")}</a:lstStyle>`
  const text = prompt === undefined ? paragraphs(lines ?? []) : paragraphs([prompt])
  const field = ph.type === "sldNum" ? fieldParagraph(style) : text
  return `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="${escaped(name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${kind}${index}${custom}/></p:nvPr></p:nvSpPr><p:spPr>${box === undefined ? "" : frame(padded(box))}</p:spPr><p:txBody><a:bodyPr ${insets}${anchor}><a:normAutofit/></a:bodyPr>${list}${field}</p:txBody></p:sp>`
}

function fieldParagraph(style) {
  const rPr = style === undefined ? '<a:rPr lang="en-US"/>' : runProperties(style)
  return `<a:p><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum">${rPr}<a:t>‹#›</a:t></a:fld></a:p>`
}

export function rectangle(id, name, box, color) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="${escaped(name)}"/><p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>${frame(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${solid(color)}<a:ln><a:noFill/></a:ln></p:spPr></p:sp>`
}

export function textBox(id, name, box, lines, style, anchor = "t") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="${escaped(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${frame(padded(box))}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" ${insets} anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs(lines, style)}</p:txBody></p:sp>`
}

export const tree = (shapes) => `<p:spTree>${group}${shapes.join("")}</p:spTree>`
