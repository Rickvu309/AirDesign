import { editorGradientAttrs } from "./editor-gradient.js"
import { assetIcon, assetMedia } from "@airdesign/document"
import { partDeclares } from "./blip-edit.js"
import { withChild, slotRoot, type Slot } from "./slot-edit.js"
import type { ChildOf, OrderedParent } from "./child-order.js"
import { colorXml, solidFillXml } from "./color-xml.js"
import type { Fill } from "./fill-read.js"
import { decodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { blipMarkup, linkedSource, type AddedPicture } from "./picture-write.js"
import type { ElementAt } from "./xml-codec.js"

export type FillTag = "a:noFill" | "a:solidFill" | "a:gradFill" | "a:pattFill" | "a:grpFill" | "a:blipFill"

export type Written = { readonly tag: FillTag; readonly xml: string }

type Gradient = Extract<Fill, { readonly gradient: unknown }>["gradient"]

export type Drawn = Exclude<Fill, { readonly image: unknown }>

function flagText(value: boolean): string {
  return value ? "1" : "0"
}

function gradientXml(fill: Gradient): string {
  const stops = fill.stops.map((stop) => `<a:gs pos="${stop.pos}">${colorXml(stop.color)}</a:gs>`).join("")
  const { shade } = fill
  const custom = "angular" in shade || "diamond" in shade ? shade : null
  const mode =
    "linear" in shade
      ? `<a:lin ang="${shade.linear.angle}" scaled="${flagText(shade.linear.scaled)}"/>`
      : "path" in shade
        ? `<a:path path="${shade.path.kind}"><a:fillToRect l="${shade.path.focus.l}" t="${shade.path.focus.t}" r="${shade.path.focus.r}" b="${shade.path.focus.b}"/></a:path>`
        : '<a:lin ang="0" scaled="0"/>'
  return `<a:gradFill rotWithShape="${flagText(fill.rotateWithShape)}"${custom === null ? "" : editorGradientAttrs(custom)}><a:gsLst>${stops}</a:gsLst>${mode}</a:gradFill>`
}

function keptGradient(xml: string, previous: Uint8Array | null): string {
  const elements = previous === null ? [] : requireMarkup(previous).elements
  const root = elements[0]
  if (previous === null || root === undefined || root.kind !== "a:gradFill") return xml
  const flip = root.attributes.find((each) => each.name === "flip")
  const tile = elements.find((each) => each.parent === root.index && each.kind === "a:tileRect")
  const flipped =
    flip === undefined
      ? xml
      : xml.replace(
          "<a:gradFill ",
          `<a:gradFill flip="${decodeUtf8(previous.subarray(flip.valueStart, flip.valueEnd))}" `,
        )
  if (tile === undefined) return flipped
  return `${flipped.slice(0, -"</a:gradFill>".length)}${decodeUtf8(previous.subarray(tile.start, tile.end))}</a:gradFill>`
}

export function fillMarkup(fill: Drawn, previous: Uint8Array | null = null): Written {
  if ("none" in fill) return { tag: "a:noFill", xml: "<a:noFill/>" }
  if ("group" in fill) return { tag: "a:grpFill", xml: "<a:grpFill/>" }
  if ("solid" in fill) return { tag: "a:solidFill", xml: solidFillXml(fill.solid) }
  if ("gradient" in fill) return { tag: "a:gradFill", xml: keptGradient(gradientXml(fill.gradient), previous) }
  const { preset, fg, bg } = fill.pattern
  return {
    tag: "a:pattFill",
    xml: `<a:pattFill prst="${preset}"><a:fgClr>${colorXml(fg)}</a:fgClr><a:bgClr>${colorXml(bg)}</a:bgClr></a:pattFill>`,
  }
}

export function filledChild<P extends OrderedParent>(parent: P, tags: readonly string[], fill: Drawn): Slot {
  return (slot) => {
    const root = slotRoot(slot)
    const own = requireMarkup(slot).elements.find((each) => each.parent === root.index && each.kind === "a:gradFill")
    const written = fillMarkup(fill, own === undefined ? null : slot.subarray(own.start, own.end))
    return withChild(parent, tags, written.tag as ChildOf<P>, written.xml)(slot)
  }
}

function imageSource(at: ElementAt, ref: string): AddedPicture["source"] | null {
  const icon = assetIcon(ref)
  if (icon !== null) return { icon }
  const media = assetMedia(ref)
  const bytes = media === null ? undefined : at.media?.(media.sha256)
  return media === null || bytes === undefined ? null : { media, bytes }
}

export function imageMarkup(parts: Map<string, Uint8Array>, at: ElementAt, ref: string): Written {
  const source = imageSource(at, ref)
  if (source === null) throw new Error("fills-image")
  const blip = blipMarkup(linkedSource(parts, at.part, source), partDeclares(partBytes(parts, at.part)))
  return {
    tag: "a:blipFill",
    xml: `<a:blipFill rotWithShape="1">${blip}<a:stretch><a:fillRect/></a:stretch></a:blipFill>`,
  }
}
