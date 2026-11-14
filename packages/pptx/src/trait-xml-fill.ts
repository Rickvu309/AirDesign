import { insertChild } from "./child-order.js"
import { colorXml, solidFillXml } from "./color-xml.js"
import { fillKinds } from "./color-read.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { ownBackground, shownFill, type Fill } from "./fill-read.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

type FillTag = "a:noFill" | "a:solidFill" | "a:gradFill" | "a:pattFill" | "a:grpFill"

type Written = { readonly tag: FillTag; readonly xml: string }

function flagText(value: boolean): string {
  return value ? "1" : "0"
}

function gradientXml(fill: Extract<Fill, { readonly gradient: unknown }>["gradient"]): string {
  const stops = fill.stops.map((stop) => `<a:gs pos="${stop.pos}">${colorXml(stop.color)}</a:gs>`).join("")
  const shade =
    "linear" in fill.shade
      ? `<a:lin ang="${fill.shade.linear.angle}" scaled="${flagText(fill.shade.linear.scaled)}"/>`
      : `<a:path path="${fill.shade.path.kind}"><a:fillToRect l="${fill.shade.path.focus.l}" t="${fill.shade.path.focus.t}" r="${fill.shade.path.focus.r}" b="${fill.shade.path.focus.b}"/></a:path>`
  return `<a:gradFill rotWithShape="${flagText(fill.rotateWithShape)}"><a:gsLst>${stops}</a:gsLst>${shade}</a:gradFill>`
}

export function fillMarkup(fill: Fill): Written {
  if ("none" in fill) return { tag: "a:noFill", xml: "<a:noFill/>" }
  if ("group" in fill) return { tag: "a:grpFill", xml: "<a:grpFill/>" }
  if ("solid" in fill) return { tag: "a:solidFill", xml: solidFillXml(fill.solid) }
  if ("gradient" in fill) return { tag: "a:gradFill", xml: gradientXml(fill.gradient) }
  const { preset, fg, bg } = fill.pattern
  return {
    tag: "a:pattFill",
    xml: `<a:pattFill prst="${preset}"><a:fgClr>${colorXml(fg)}</a:fgClr><a:bgClr>${colorXml(bg)}</a:bgClr></a:pattFill>`,
  }
}

function changedPart(parts: Parts, part: string, bytes: Uint8Array, edit: ByteEdit | null): Parts {
  if (edit === null) return parts
  const next = spliceBytes(bytes, [edit])
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(part, next)
  return changed
}

function writtenBackground(parts: Parts, at: ElementAt, written: Written | null): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const root = elements.find((element) => element.parent < 0)
  const body = elements.find((element) => element.kind === "p:cSld" && element.parent === root?.index)
  if (body === undefined || body.selfClosing) throw new Error("p:cSld")
  const own = elements.find((element) => element.kind === "p:bg" && element.parent === body.index)
  const next = encodeUtf8(written === null ? "" : `<p:bg><p:bgPr>${written.xml}<a:effectLst/></p:bgPr></p:bg>`)
  if (own !== undefined) return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  return written === null ? parts : changedPart(parts, at.part, bytes, { start: body.openEnd, end: body.openEnd, next })
}

function writtenFill(parts: Parts, at: ElementAt, written: Written | null): Parts {
  if (at.shape === "slide") return writtenBackground(parts, at, written)
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, at.shape)
  if (shape.kind !== "p:sp") throw new Error("fill-shape")
  const properties = elements.filter((item) => item.parent === shape.index && item.kind === "p:spPr")
  const spPr = properties[0]
  if (properties.length !== 1 || spPr === undefined) throw new Error("fill-properties")
  const fills = elements.filter((item) => item.parent === spPr.index && fillKinds.has(item.kind))
  const fill = fills[0]
  if (fills.length > 1) throw new Error("fill-choice")
  let edit: ByteEdit | null = null
  if (fill !== undefined) edit = { start: fill.start, end: fill.end, next: encodeUtf8(written?.xml ?? "") }
  else if (written !== null && spPr.selfClosing)
    edit = { start: spPr.openEnd - 2, end: spPr.openEnd, next: encodeUtf8(`>${written.xml}</p:spPr>`) }
  else if (written !== null) {
    const parent = decodeUtf8(bytes.subarray(spPr.start, spPr.end))
    edit = {
      start: spPr.start,
      end: spPr.end,
      next: encodeUtf8(insertChild("p:spPr", written.tag, written.xml, parent)),
    }
  }
  return changedPart(parts, at.part, bytes, edit)
}

export const fillXml: TraitXml<"fill"> = {
  slot: null,
  fields: {
    value: whole(
      {
        read: (parts, at) =>
          at.shape === "slide" ? ownBackground(parts, at.part) : (shownFill(parts, at)?.value ?? null),
        write: (parts, at, value) => writtenFill(parts, at, fillMarkup(value)),
      },
      (parts, at) => writtenFill(parts, at, null),
    ),
  },
}
