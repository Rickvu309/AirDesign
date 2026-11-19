import { tileRatios } from "./picture-tile.js"
import { svgEmbed } from "./blip-edit.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintColor, type PaintPalette } from "./paint-color.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintCrop = { left: number; top: number; right: number; bottom: number }

export type PaintRecolor = { grayscale: true } | { duotone: readonly [PaintColor, PaintColor] }

export type PaintImage = {
  part: string
  contentType: string | null
  crop: PaintCrop
  destination?: PaintCrop
  tile: boolean
  tileScale?: { x: number; y: number }
  alpha?: number
  recolor?: PaintRecolor
  blur?: number
  overlay?: PaintColor
}

const opaque = 100000

const colorKinds = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])

const recolorOf = (
  blip: MarkupElement,
  children: MarkupChildren,
  palette: PaintPalette | null,
): Pick<PaintImage, "recolor"> => {
  const inside = children[blip.index] ?? []
  if (inside.some((element) => element.kind === "a:grayscl")) return { recolor: { grayscale: true } }
  const duotone = inside.find((element) => element.kind === "a:duotone")
  if (duotone === undefined || palette === null) return {}
  const colors = (children[duotone.index] ?? []).filter((element) => colorKinds.has(element.kind))
  const [dark, light] = colors.map((element) => paintColor(element, children, palette))
  return colors.length !== 2 || dark == null || light == null ? {} : { recolor: { duotone: [dark, light] } }
}

const emuPerPx = 9525

const blurOf = (blip: MarkupElement, children: MarkupChildren): Pick<PaintImage, "blur"> => {
  const blur = (children[blip.index] ?? []).find((element) => element.kind === "a:blur")
  const radius = blur === undefined ? null : paintAttribute(blur, "rad")
  if (blur === undefined || (radius !== null && !/^\d+$/.test(radius))) return {}
  const value = radius === null ? 0 : Number(radius)
  return value <= 0 ? {} : { blur: value / emuPerPx }
}

const overlayOf = (
  blip: MarkupElement,
  children: MarkupChildren,
  palette: PaintPalette | null,
): Pick<PaintImage, "overlay"> => {
  const overlay = (children[blip.index] ?? []).find((element) => element.kind === "a:fillOverlay")
  if (overlay === undefined || paintAttribute(overlay, "blend") !== "over") return {}
  const solid = (children[overlay.index] ?? []).find((element) => element.kind === "a:solidFill")
  const color =
    solid === undefined ? undefined : (children[solid.index] ?? []).find((element) => colorKinds.has(element.kind))
  if (color === undefined) return {}
  const painted = paintColor(
    color,
    children,
    palette ?? { children, slots: new Map(), mapping: new Map(), placeholder: null },
  )
  return painted === null ? {} : { overlay: painted }
}

const alphaOf = (blip: MarkupElement, children: MarkupChildren): Pick<PaintImage, "alpha"> => {
  const fixed = (children[blip.index] ?? []).find((element) => element.kind === "a:alphaModFix")
  const amount = fixed === undefined ? null : paintAttribute(fixed, "amt")
  if (fixed === undefined || (amount !== null && !/^\d+$/.test(amount))) return {}
  const value = amount === null ? opaque : Math.min(opaque, Number(amount))
  return value >= opaque ? {} : { alpha: value / opaque }
}

export type PaintPicture = (id: string) => Pick<PaintImage, "part" | "contentType"> | null

export const paintImage = (
  fill: MarkupElement | undefined,
  children: MarkupChildren,
  picture: PaintPicture,
  palette: PaintPalette | null = null,
): PaintImage | null => {
  if (fill === undefined) return null
  const inside = children[fill.index] ?? []
  const blip = inside.find((element) => element.kind === "a:blip")
  const id = blip === undefined ? null : paintAttribute(blip, "r:embed")
  const svg = blip === undefined ? null : svgEmbed(children, blip)
  const image = (svg === null ? null : picture(svg)) ?? (id === null ? null : picture(id))
  if (image === null || blip === undefined) return null
  const rectangle = inside.find((element) => element.kind === "a:srcRect")
  const side = (name: string): number => {
    const value = rectangle === undefined ? null : paintAttribute(rectangle, name)
    if (value === null || !/^[+-]?\d+$/.test(value)) return 0
    const number = Number(value)
    return Number.isSafeInteger(number) ? number / 100000 : 0
  }
  const stretch = inside.find((item) => item.kind === "a:stretch")
  const rect = stretch === undefined ? undefined : children[stretch.index]?.find((item) => item.kind === "a:fillRect")
  const destination = (name: string) => Number(rect === undefined ? 0 : (paintAttribute(rect, name) ?? 0)) / 100000
  const placed = rect !== undefined && ["l", "t", "r", "b"].some((name) => destination(name) !== 0)
  const tile = inside.find((element) => element.kind === "a:tile")
  const ratios = tile === undefined ? null : tileRatios(tile)
  return {
    ...image,
    ...(placed
      ? {
          destination: {
            left: destination("l"),
            top: destination("t"),
            right: destination("r"),
            bottom: destination("b"),
          },
        }
      : {}),
    crop: { left: side("l"), top: side("t"), right: side("r"), bottom: side("b") },
    tile: tile !== undefined,
    ...(ratios === null || (ratios.x === opaque && ratios.y === opaque)
      ? {}
      : { tileScale: { x: ratios.x / opaque, y: ratios.y / opaque } }),
    ...alphaOf(blip, children),
    ...recolorOf(blip, children, palette),
    ...blurOf(blip, children),
    ...overlayOf(blip, children, palette),
  }
}

export const paintContentType = (parts: ReadonlyMap<string, Uint8Array>): ((part: string) => string | null) => {
  let defaults: Map<string, string> | undefined
  const overrides = new Map<string, string>()
  return (part) => {
    if (defaults === undefined) {
      defaults = new Map()
      const bytes = parts.get("[Content_Types].xml")
      for (const element of bytes === undefined ? [] : markupDocument(bytes).elements) {
        const type = paintAttribute(element, "ContentType")
        if (type === null) continue
        const name = paintAttribute(element, element.kind === "Override" ? "PartName" : "Extension")
        if (name === null) continue
        if (element.kind === "Override") overrides.set(name.replace(/^\//, ""), type)
        else if (element.kind === "Default") defaults.set(name.toLowerCase(), type)
      }
    }
    const extension = part.split("/").pop()?.split(".").slice(1).pop()?.toLowerCase() ?? ""
    return overrides.get(part) ?? defaults.get(extension) ?? null
  }
}

export const paintPictureFill = (
  element: MarkupElement,
  elements: readonly MarkupElement[],
  children: MarkupChildren,
): MarkupElement | undefined => {
  const child = (parent: MarkupElement | undefined, kind: string) =>
    parent === undefined ? undefined : children[parent.index]?.find((item) => item.kind === kind)
  const fill = (picture: MarkupElement | undefined) => child(picture, "p:blipFill")
  if (element.kind === "p:pic") return fill(element)
  if (element.kind !== "p:graphicFrame") return undefined
  const graphic = child(element, "a:graphic")
  const data = child(graphic, "a:graphicData")
  const ole = child(data, "p:oleObj")
  const own = fill(child(ole, "p:pic"))
  if (own !== undefined) return own
  const choice = elements[element.parent]
  const alternate = choice === undefined ? undefined : elements[choice.parent]
  return choice?.kind === "mc:Choice" && alternate?.kind === "mc:AlternateContent"
    ? fill(child(child(alternate, "mc:Fallback"), "p:pic"))
    : undefined
}
