import { assetIcon, assetMedia, iconWeights, type Alpha, type FieldValue } from "@airdesign/document"
import { blipPieces, blipWritten, blipXml, partDeclares, withEmbed, type BlipPieces } from "./blip-edit.js"
import { colorXml, solidFillXml } from "./color-xml.js"
import { blurRadius } from "./picture-adjust.js"
import { linkedSource, svgExt, svgExtension, type AddedPicture } from "./picture-write.js"
import { shownImage, type Overlay, type Recolor } from "./picture-read.js"
import { whole, type ElementAt, type FieldXml, type Parts } from "./xml-codec.js"

import { shownPictureMode, writtenPictureMode } from "./picture-mode.js"

const opaque = 100_000
const recolorKinds: readonly string[] = ["a:grayscl", "a:duotone"]
const blipOrder = ["a:alphaModFix", "a:grayscl", "a:duotone", "a:blur", "a:fillOverlay"]

function recolorXml(recolor: Recolor): string {
  if ("grayscale" in recolor) return "<a:grayscl/>"
  if ("duotone" in recolor)
    return `<a:duotone>${colorXml(recolor.duotone.dark)}${colorXml(recolor.duotone.light)}</a:duotone>`
  return ""
}

function withEffect(pieces: BlipPieces, drop: readonly string[], kind: string, xml: string): BlipPieces {
  const kept = pieces.effects.filter((each) => !drop.includes(each.kind))
  if (xml === "") return { ...pieces, effects: kept }
  const next = { kind, xml }
  const rank = blipOrder.indexOf(kind)
  const index = kept.findIndex((each) => {
    const other = blipOrder.indexOf(each.kind)
    return rank !== -1 && other !== -1 && other > rank
  })
  const effects = index === -1 ? [...kept, next] : [...kept.slice(0, index), next, ...kept.slice(index)]
  return { ...pieces, effects }
}

function linkedBlip(parts: Parts, at: ElementAt, source: AddedPicture["source"]): Parts {
  const next = new Map(parts)
  const linked = linkedSource(next, at.part, source)
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

function writtenSource(parts: Parts, at: ElementAt, ref: string): Parts {
  const media = assetMedia(ref)
  const bytes = media === null ? undefined : at.media?.(media.sha256)
  if (media === null && assetIcon(ref) === null) throw new Error("image-source")
  if (media !== null && bytes === undefined) return parts
  const mode = media === null ? null : shownPictureMode(parts, at)
  const weight = shownImage(parts, at)?.weight ?? iconWeights.lucide
  const written = linkedBlip(parts, at, media === null ? { icon: ref, weight } : { media, bytes })
  return mode === "fill" || mode === "fit" ? writtenPictureMode(written, at, mode) : written
}

function writtenWeight(parts: Parts, at: ElementAt, weight: number): Parts {
  const icon = shownImage(parts, at)?.source ?? null
  return icon === null ? parts : linkedBlip(parts, at, { icon, weight })
}

function writtenAlpha(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const xml = alpha >= opaque ? "" : `<a:alphaModFix amt="${String(alpha)}"/>`
  return blipWritten(parts, at, (found, blip) =>
    blipXml(withEffect(blipPieces(found, blip), ["a:alphaModFix"], "a:alphaModFix", xml)),
  )
}

function writtenBlur(parts: Parts, at: ElementAt, blur: number): Parts {
  const xml = blur <= 0 ? "" : `<a:blur rad="${String(blurRadius(blur))}" grow="0"/>`
  return blipWritten(parts, at, (found, blip) =>
    blipXml(withEffect(blipPieces(found, blip), ["a:blur"], "a:blur", xml)),
  )
}

function writtenOverlay(parts: Parts, at: ElementAt, overlay: Overlay): Parts {
  const xml = "solid" in overlay ? `<a:fillOverlay blend="over">${solidFillXml(overlay.solid)}</a:fillOverlay>` : ""
  return blipWritten(parts, at, (found, blip) =>
    blipXml(withEffect(blipPieces(found, blip), ["a:fillOverlay"], "a:fillOverlay", xml)),
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

export const imageFieldsXml = {
  source: whole({ read: (parts, at) => shownImage(parts, at)?.source ?? null, write: writtenSource }),
  weight: whole({ read: (parts, at) => shownImage(parts, at)?.weight ?? null, write: writtenWeight }),
  mode: whole({ read: shownPictureMode, write: writtenPictureMode }),
  recolor: whole({ read: (parts, at) => shownImage(parts, at)?.recolor ?? null, write: writtenRecolor }),
  blur: whole({
    read: (parts, at) => {
      const blur = shownImage(parts, at)?.blur
      return blur == null || blur > opaque ? null : blur
    },
    write: writtenBlur,
  }),
} satisfies { readonly [F in "source" | "weight" | "mode" | "recolor" | "blur"]: FieldXml<FieldValue<"fills", F>> }

export function blipOverlay(parts: Parts, at: ElementAt): Overlay | null {
  const overlay = shownImage(parts, at)?.overlay ?? null
  return overlay === null || "none" in overlay ? null : overlay
}

export function withoutOverlay(parts: Parts, at: ElementAt): Parts {
  return blipOverlay(parts, at) === null ? parts : writtenOverlay(parts, at, { none: true })
}

export function imageAlpha(parts: Parts, at: ElementAt): Alpha | null {
  return (shownImage(parts, at)?.alpha ?? null) as Alpha | null
}

export { writtenAlpha as writtenImageAlpha }
