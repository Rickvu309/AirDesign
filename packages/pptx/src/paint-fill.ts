import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintFill, type PaintGradientPath, type PaintPalette } from "./paint-color.js"
import type { MarkupChildren } from "./text-value-route.js"
import { paintImage, type PaintPicture } from "./paint-image.js"

export const paintChild = (
  children: MarkupChildren,
  parent: MarkupElement | undefined,
  kind: string,
): MarkupElement | undefined =>
  parent === undefined ? undefined : children[parent.index]?.find((element) => element.kind === kind)

const percentage = (value: string | null): number | null =>
  value === null ? 0 : /^\d+$/.test(value) && Number(value) <= 100000 ? Number(value) / 100000 : null

const paintGradientPath = (children: MarkupChildren, path: MarkupElement): PaintGradientPath | undefined => {
  const kind = paintAttribute(path, "path")
  if (kind !== "circle" && kind !== "rect" && kind !== "shape") return undefined
  const rect = paintChild(children, path, "a:fillToRect")
  if (rect === undefined) return { kind, focus: null }
  const left = percentage(paintAttribute(rect, "l"))
  const top = percentage(paintAttribute(rect, "t"))
  const right = percentage(paintAttribute(rect, "r"))
  const bottom = percentage(paintAttribute(rect, "b"))
  return left === null || top === null || right === null || bottom === null
    ? undefined
    : { kind, focus: { left, top, right, bottom } }
}

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
    const image = paintImage(fill, children, picture, palette)
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
  stops.sort((left, right) => left.position - right.position)
  const linear = paintChild(children, fill, "a:lin")
  const angle = linear === undefined ? null : paintAttribute(linear, "ang")
  if (linear !== undefined && (angle === null || !/^\d+$/.test(angle) || Number(angle) >= 21600000)) return null
  const shade = paintChild(children, fill, "a:path")
  const path = shade === undefined ? null : (paintGradientPath(children, shade) ?? null)
  if (shade !== undefined && path === null) return null
  return { type: "gradient", stops, angle: angle === null ? null : Number(angle) / 60000, path }
}
