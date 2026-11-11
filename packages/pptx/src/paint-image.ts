import { markupDocument, type MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintCrop = { left: number; top: number; right: number; bottom: number }

export type PaintImage = {
  part: string
  contentType: string | null
  crop: PaintCrop
  tile: boolean
}

export type PaintPicture = (id: string) => Pick<PaintImage, "part" | "contentType"> | null

export const paintImage = (
  fill: MarkupElement | undefined,
  children: MarkupChildren,
  picture: PaintPicture,
): PaintImage | null => {
  if (fill === undefined) return null
  const inside = children[fill.index] ?? []
  const blip = inside.find((element) => element.kind === "a:blip")
  const id = blip === undefined ? null : paintAttribute(blip, "r:embed")
  const image = id === null ? null : picture(id)
  if (image === null) return null
  const rectangle = inside.find((element) => element.kind === "a:srcRect")
  const side = (name: string): number => {
    const value = rectangle === undefined ? null : paintAttribute(rectangle, name)
    if (value === null || !/^[+-]?\d+$/.test(value)) return 0
    const number = Number(value)
    return Number.isSafeInteger(number) ? number / 100000 : 0
  }
  return {
    ...image,
    crop: { left: side("l"), top: side("t"), right: side("r"), bottom: side("b") },
    tile: inside.some((element) => element.kind === "a:tile"),
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
