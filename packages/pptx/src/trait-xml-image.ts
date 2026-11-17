import { assetIcon, type Alpha } from "@airdesign/document"
import { blipPieces, blipWritten, blipXml, partDeclares, withEmbed, type BlipPieces } from "./blip-edit.js"
import { colorXml } from "./color-xml.js"
import { linkedSource, svgExt, svgExtension } from "./picture-write.js"
import { shownImage, type Recolor } from "./picture-read.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

import { shownPictureMode, writtenPictureMode } from "./picture-mode.js"

const opaque = 100_000
const recolorKinds: readonly string[] = ["a:grayscl", "a:duotone"]

function recolorXml(recolor: Recolor): string {
  if ("grayscale" in recolor) return "<a:grayscl/>"
  if ("duotone" in recolor)
    return `<a:duotone>${colorXml(recolor.duotone.dark)}${colorXml(recolor.duotone.light)}</a:duotone>`
  return ""
}

function withEffect(pieces: BlipPieces, drop: readonly string[], kind: string, xml: string): BlipPieces {
  const kept = pieces.effects.filter((each) => !drop.includes(each.kind))
  return { ...pieces, effects: xml === "" ? kept : [...kept, { kind, xml }] }
}

function writtenSource(parts: Parts, at: ElementAt, ref: string): Parts {
  const icon = assetIcon(ref)
  if (icon === null) throw new Error("image-source")
  const next = new Map(parts)
  const linked = linkedSource(next, at.part, { icon })
  return blipWritten(next, at, (found, blip) => {
    const pieces = blipPieces(found, blip)
    const exts = pieces.exts.filter((each) => each.uri !== svgExtension)
    const open = withEmbed(found, blip, linked.embed, partDeclares(found.bytes))
    return blipXml({
      ...pieces,
      open,
      exts: linked.svg === null ? exts : [...exts, { uri: svgExtension, xml: svgExt(linked.svg) }],
    })
  })
}

function writtenAlpha(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const xml = alpha >= opaque ? "" : `<a:alphaModFix amt="${String(alpha)}"/>`
  return blipWritten(parts, at, (found, blip) =>
    blipXml(withEffect(blipPieces(found, blip), ["a:alphaModFix"], "a:alphaModFix", xml)),
  )
}

function writtenRecolor(parts: Parts, at: ElementAt, recolor: Recolor): Parts {
  return blipWritten(parts, at, (found, blip) =>
    blipXml(
      withEffect(
        blipPieces(found, blip),
        recolorKinds,
        "grayscale" in recolor ? "a:grayscl" : "a:duotone",
        recolorXml(recolor),
      ),
    ),
  )
}

export const imageXml: TraitXml<"image"> = {
  slot: null,
  fields: {
    mode: whole({ read: shownPictureMode, write: writtenPictureMode }),
    source: whole({ read: (parts, at) => shownImage(parts, at)?.source ?? null, write: writtenSource }),
    alpha: whole({
      read: (parts, at) => (shownImage(parts, at)?.alpha ?? null) as Alpha | null,
      write: writtenAlpha,
    }),
    recolor: whole({ read: (parts, at) => shownImage(parts, at)?.recolor ?? null, write: writtenRecolor }),
  },
}
