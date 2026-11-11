import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintFill, type PaintPalette } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { PaintPicture } from "./paint-image.js"

export type PaintLine = {
  fill: PaintFill
  width: number
  dash: string | null
  head: string | null
  tail: string | null
}

export type PaintSource = {
  element: MarkupElement
  children: MarkupChildren
  part: string
  groupFill: PaintFill | null
}

export type PaintStyles = {
  children: MarkupChildren
  part: string
  fills: readonly MarkupElement[]
  lines: readonly MarkupElement[]
}

export type ShapePaint = {
  fill: PaintFill | null
  line: PaintLine | null
  geometry: string | null
}

const fillKinds = ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill", "a:grpFill"]

const propertiesOf = (source: PaintSource) =>
  paintChild(source.children, source.element, source.element.kind === "p:grpSp" ? "p:grpSpPr" : "p:spPr")

const fillOf = (source: PaintSource, holder: MarkupElement | undefined) =>
  holder === undefined ? undefined : source.children[holder.index]?.find((element) => fillKinds.includes(element.kind))

const referenceOf = (sources: readonly PaintSource[], kind: string) => {
  for (const source of sources) {
    const style = paintChild(source.children, source.element, "p:style")
    const reference = paintChild(source.children, style, kind)
    if (reference !== undefined) return { source, reference }
  }
  return null
}

export const paintShape = (
  sources: readonly PaintSource[],
  styles: PaintStyles | null,
  palette: PaintPalette,
  picture: (part: string, id: string) => ReturnType<PaintPicture>,
): ShapePaint => {
  const own = sources[0]
  if (own === undefined || own.element.kind === "p:graphicFrame") return { fill: null, line: null, geometry: null }
  const readFill = (source: PaintSource, fill: MarkupElement, colors = palette): PaintFill | null =>
    fill.kind === "a:grpFill"
      ? source.groupFill
      : paintFill(fill, source.children, colors, (id) => picture(source.part, id), true)
  const styleOf = (kind: string, list: readonly MarkupElement[]) => {
    const found = referenceOf(sources, kind)
    if (found === null) return null
    const value = paintAttribute(found.reference, "idx")
    const index = value !== null && /^\d+$/.test(value) ? Number(value) : -1
    const color = found.source.children[found.reference.index]?.[0]
    return {
      index,
      element: list[index - 1],
      palette: {
        ...palette,
        placeholder: color === undefined ? null : paintColor(color, found.source.children, palette),
      },
    }
  }
  let fill: PaintFill | null = null
  let hasFill = false
  for (const source of sources) {
    const child = fillOf(source, propertiesOf(source))
    if (child === undefined) continue
    fill = readFill(source, child)
    hasFill = true
    break
  }
  const themeSource = styles === null ? null : { ...own, children: styles.children, part: styles.part }
  if (!hasFill) {
    const style = styleOf("a:fillRef", styles?.fills ?? [])
    if (style?.index === 0) fill = { type: "none" }
    else if (style?.element !== undefined && themeSource !== null)
      fill = readFill(themeSource, style.element, style.palette)
  }
  const lines = sources.flatMap((source) => {
    const element = paintChild(source.children, propertiesOf(source), "a:ln")
    return element === undefined ? [] : [{ source, element, palette }]
  })
  const style = styleOf("a:lnRef", styles?.lines ?? [])
  if (style?.element !== undefined && themeSource !== null)
    lines.push({ source: themeSource, element: style.element, palette: style.palette })
  let line: PaintLine | null = null
  if (lines.length > 0) {
    let lineFill: PaintFill | null = null
    let hasLineFill = false
    let width: number | null = null
    let dash: string | null = null
    let head: string | null = null
    let tail: string | null = null
    for (const level of lines) {
      const child = fillOf(level.source, level.element)
      if (!hasLineFill && child !== undefined) {
        lineFill = readFill(level.source, child, level.palette)
        hasLineFill = true
      }
      const value = paintAttribute(level.element, "w")
      if (width === null && value !== null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)))
        width = Number(value)
      const attributeOf = (kind: string, name: string) => {
        const child = paintChild(level.source.children, level.element, kind)
        return child === undefined ? null : paintAttribute(child, name)
      }
      dash ??= attributeOf("a:prstDash", "val")
      head ??= attributeOf("a:headEnd", "type")
      tail ??= attributeOf("a:tailEnd", "type")
    }
    line = { fill: lineFill ?? { type: "none" }, width: width ?? 9525, dash, head, tail }
  }
  let geometry: string | null = null
  for (const source of sources) {
    const properties = propertiesOf(source)
    const preset = paintChild(source.children, properties, "a:prstGeom")
    if (preset !== undefined) {
      geometry = paintAttribute(preset, "prst")
      break
    }
    if (paintChild(source.children, properties, "a:custGeom") !== undefined) {
      geometry = "custom"
      break
    }
  }
  return { fill, line, geometry }
}
