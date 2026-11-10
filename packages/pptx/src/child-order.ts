export const childOrder = {
  "p:spPr": [
    "a:xfrm",
    "a:custGeom",
    "a:prstGeom",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:ln",
    "a:effectLst",
    "a:effectDag",
    "a:scene3d",
    "a:sp3d",
    "a:extLst",
  ],
  "p:txBody": ["a:bodyPr", "a:lstStyle", "a:p"],
  "a:p": ["a:pPr", "a:r", "a:br", "a:fld", "a:endParaRPr"],
  "a:rPr": [
    "a:ln",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:effectLst",
    "a:effectDag",
    "a:highlight",
    "a:uLnTx",
    "a:uLn",
    "a:uFillTx",
    "a:uFill",
    "a:latin",
    "a:ea",
    "a:cs",
    "a:sym",
    "a:hlinkClick",
    "a:hlinkMouseOver",
    "a:rtl",
    "a:extLst",
  ],
} as const

export type OrderedParent = keyof typeof childOrder
export type ChildOf<P extends OrderedParent> = (typeof childOrder)[P][number]

type Slice = { readonly tag: string; readonly end: number }

function elementBoundary(xml: string, name: string): boolean {
  const prefix = `<${name}`
  if (!xml.startsWith(prefix)) return false
  const next = xml[prefix.length]
  return next === ">" || next === "/" || next === " " || next === "\n" || next === "\t"
}

function tagEnd(xml: string, from: number): number {
  let quote: string | null = null
  for (let index = from; index < xml.length; index += 1) {
    const char = xml[index]
    if (quote !== null) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === ">") return index
  }
  throw new Error("unclosed tag")
}

function tagName(xml: string, open: number): string {
  let index = open + 1
  while (index < xml.length) {
    const char = xml[index]
    if (char === undefined || char === " " || char === "\n" || char === "\t" || char === "/" || char === ">") break
    index += 1
  }
  return xml.slice(open + 1, index)
}

function emptyTag(xml: string, open: number, end: number): boolean {
  let index = end - 1
  while (index > open && (xml[index] === " " || xml[index] === "\n" || xml[index] === "\t")) index -= 1
  return xml[index] === "/"
}

function rank(parent: OrderedParent, tag: string): number {
  const order: readonly string[] = childOrder[parent]
  const index = order.indexOf(tag)
  if (index < 0) throw new Error(`${parent} ${tag}`)
  return index
}

function splitParent(
  xml: string,
  parent: OrderedParent,
): { readonly open: string; readonly inner: string; readonly close: string } {
  if (!elementBoundary(xml, parent)) throw new Error(`parent ${parent}`)
  const openEnd = tagEnd(xml, 0)
  if (emptyTag(xml, 0, openEnd)) throw new Error(`empty ${parent}`)
  let depth = 1
  let index = openEnd + 1
  while (index < xml.length) {
    if (xml.startsWith("<!--", index)) {
      const comment = xml.indexOf("-->", index + 4)
      index = comment < 0 ? xml.length : comment + 3
      continue
    }
    if (xml[index] !== "<") {
      index += 1
      continue
    }
    const end = tagEnd(xml, index)
    if (xml.startsWith("</", index)) {
      depth -= 1
      if (depth === 0) {
        if (xml.slice(index, end + 1) !== `</${parent}>`) throw new Error(`close ${parent}`)
        if (end !== xml.length - 1) throw new Error(`trailing ${parent}`)
        return { open: xml.slice(0, openEnd + 1), inner: xml.slice(openEnd + 1, index), close: xml.slice(index) }
      }
    } else if (!emptyTag(xml, index, end)) {
      depth += 1
    }
    index = end + 1
  }
  throw new Error(`unclosed ${parent}`)
}

function directChildren(inner: string, parent: OrderedParent): readonly Slice[] {
  const children: Slice[] = []
  let depth = 0
  let childStart = 0
  let index = 0
  while (index < inner.length) {
    if (inner.startsWith("<!--", index)) {
      const comment = inner.indexOf("-->", index + 4)
      index = comment < 0 ? inner.length : comment + 3
      continue
    }
    if (inner[index] !== "<") {
      index += 1
      continue
    }
    const end = tagEnd(inner, index)
    if (inner.startsWith("</", index)) {
      depth -= 1
      if (depth === 0) children.push({ tag: tagName(inner, childStart), end: end + 1 })
    } else if (depth === 0 && emptyTag(inner, index, end)) {
      children.push({ tag: tagName(inner, index), end: end + 1 })
    } else if (!emptyTag(inner, index, end)) {
      if (depth === 0) childStart = index
      depth += 1
    }
    index = end + 1
  }
  if (depth !== 0) throw new Error(`unclosed ${parent}`)
  return children
}

export function insertChild<P extends OrderedParent>(
  parent: P,
  tag: ChildOf<P>,
  element: string,
  parentXml: string,
): string {
  if (!elementBoundary(element, tag)) throw new Error(`element ${tag}`)
  const parts = splitParent(parentXml, parent)
  const children = directChildren(parts.inner, parent)
  const insertRank = rank(parent, tag)
  let at = 0
  for (const child of children) {
    if (rank(parent, child.tag) <= insertRank) at = child.end
  }
  return parts.open + parts.inner.slice(0, at) + element + parts.inner.slice(at) + parts.close
}
