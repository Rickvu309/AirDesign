import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintFill, type PaintPalette } from "./paint-color.js"
import type { MarkupChildren } from "./text-value-route.js"
import { paintImage, type PaintPicture } from "./paint-image.js"

export const paintChild = (
  children: MarkupChildren,
  parent: MarkupElement | undefined,
  kind: string,
): MarkupElement | undefined =>
  parent === undefined ? undefined : children[parent.index]?.find((element) => element.kind === kind)

export const paintFill = (
  holder: MarkupElement,
  children: MarkupChildren,
  palette: PaintPalette,
  picture: PaintPicture,
  direct = false,
): PaintFill | null => {
  const fill = direct
    ? holder
    : (children[holder.index] ?? []).find((element) =>
        ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill"].includes(element.kind),
      )
  if (fill === undefined) return null
  const colorIn = (parent: MarkupElement | undefined) => {
    const color = parent === undefined ? undefined : children[parent.index]?.[0]
    return color === undefined ? null : paintColor(color, children, palette)
  }
  if (fill.kind === "a:noFill") return { type: "none" }
  if (fill.kind === "a:solidFill") {
    const color = colorIn(fill)
    return color === null ? null : { type: "solid", color }
  }
  if (fill.kind === "a:blipFill") {
    const image = paintImage(fill, children, picture)
    return image === null ? null : { type: "picture", ...image }
  }
  if (fill.kind === "a:pattFill") {
    const preset = paintAttribute(fill, "prst")
    const foreground = colorIn(paintChild(children, fill, "a:fgClr"))
    const background = colorIn(paintChild(children, fill, "a:bgClr"))
    return preset === null || foreground === null || background === null
      ? null
      : { type: "pattern", preset, foreground, background }
  }
  const list = paintChild(children, fill, "a:gsLst")
  const stops: { position: number; color: NonNullable<ReturnType<typeof colorIn>> }[] = []
  for (const stop of list === undefined ? [] : (children[list.index] ?? [])) {
    if (stop.kind !== "a:gs") continue
    const color = colorIn(stop)
    const position = paintAttribute(stop, "pos")
    if (color === null || position === null || !/^\d+$/.test(position) || Number(position) > 100000) return null
    stops.push({ position: Number(position) / 100000, color })
  }
  if (stops.length === 0) return null
  const linear = paintChild(children, fill, "a:lin")
  const angle = linear === undefined ? null : paintAttribute(linear, "ang")
  if (linear !== undefined && (angle === null || !/^\d+$/.test(angle) || Number(angle) >= 21600000)) return null
  return { type: "gradient", stops, angle: angle === null ? null : Number(angle) / 60000 }
}
