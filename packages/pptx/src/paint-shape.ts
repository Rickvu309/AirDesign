import { isShapeTag, shapeTags } from "./shape-tree.js"
import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintFill, type PaintPalette } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { PaintPicture } from "./paint-image.js"
import { paintEffects, type PaintEffects } from "./paint-effects.js"

export type PaintJoin = { kind: "round" | "bevel" | "miter"; limit?: number }

export type PaintDashStep = { dash: number; space: number }

export type PaintLine = {
  fill: PaintFill
  width: number
  dash: string | null
  head: string | null
  tail: string | null
  cap?: string
  compound?: string
  join?: PaintJoin
  dashes?: readonly PaintDashStep[]
  headWidth?: string
  headLength?: string
  tailWidth?: string
  tailLength?: string
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
  effects: readonly MarkupElement[]
}

export type ShapePaint = {
  fill: PaintFill | null
  line: PaintLine | null
  geometry: string | null
  adjusts?: Readonly<Record<string, number>>
  effects?: PaintEffects
}

const capKinds = ["rnd", "sq", "flat"]
const compoundKinds = ["sng", "dbl", "thickThin", "thinThick", "tri"]
const sizeKinds = ["sm", "med", "lg"]
const joinKinds = [
  ["a:round", "round"],
  ["a:bevel", "bevel"],
  ["a:miter", "miter"],
] as const

const oneOf = (kinds: readonly string[], value: string | null) =>
  value !== null && kinds.includes(value) ? value : null

const thousandths = (value: string | null) =>
  value !== null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) / 100000 : null

const joinOf = (source: PaintSource, line: MarkupElement): PaintJoin | null => {
  for (const [kind, name] of joinKinds) {
    const child = paintChild(source.children, line, kind)
    if (child === undefined) continue
    const limit = name === "miter" ? thousandths(paintAttribute(child, "lim")) : null
    return limit === null ? { kind: name } : { kind: name, limit }
  }
  return null
}

const dashesOf = (source: PaintSource, line: MarkupElement): PaintDashStep[] | null => {
  const custom = paintChild(source.children, line, "a:custDash")
  if (custom === undefined) return null
  const steps: PaintDashStep[] = []
  for (const step of source.children[custom.index] ?? []) {
    const dash = thousandths(paintAttribute(step, "d"))
    const space = thousandths(paintAttribute(step, "sp"))
    if (step.kind === "a:ds" && dash !== null && space !== null) steps.push({ dash, space })
  }
  return steps.length === 0 ? null : steps
}

const fillKinds = ["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill", "a:grpFill"]

const propertiesOf = (source: PaintSource) => {
  if (!isShapeTag(source.element.kind)) return undefined
  const properties = shapeTags[source.element.kind].properties
  return properties === null ? undefined : paintChild(source.children, source.element, properties)
}

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
  if (own === undefined || (isShapeTag(own.element.kind) && shapeTags[own.element.kind].properties === null))
    return { fill: null, line: null, geometry: null }
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
    let dashes: PaintDashStep[] | null = null
    let cap: string | null = null
    let compound: string | null = null
    let join: PaintJoin | null = null
    const sizes: Record<"headWidth" | "headLength" | "tailWidth" | "tailLength", string | null> = {
      headWidth: null,
      headLength: null,
      tailWidth: null,
      tailLength: null,
    }
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
      if (dash === null && dashes === null) {
        dashes = dashesOf(level.source, level.element)
        if (dashes === null) dash = attributeOf("a:prstDash", "val")
      }
      head ??= attributeOf("a:headEnd", "type")
      tail ??= attributeOf("a:tailEnd", "type")
      cap ??= oneOf(capKinds, paintAttribute(level.element, "cap"))
      compound ??= oneOf(compoundKinds, paintAttribute(level.element, "cmpd"))
      join ??= joinOf(level.source, level.element)
      sizes.headWidth ??= oneOf(sizeKinds, attributeOf("a:headEnd", "w"))
      sizes.headLength ??= oneOf(sizeKinds, attributeOf("a:headEnd", "len"))
      sizes.tailWidth ??= oneOf(sizeKinds, attributeOf("a:tailEnd", "w"))
      sizes.tailLength ??= oneOf(sizeKinds, attributeOf("a:tailEnd", "len"))
    }
    line = {
      fill: lineFill ?? { type: "none" },
      width: width ?? 9525,
      dash,
      head,
      tail,
      ...(cap === null ? {} : { cap }),
      ...(compound === null ? {} : { compound }),
      ...(join === null ? {} : { join }),
      ...(dashes === null ? {} : { dashes }),
      ...(sizes.headWidth === null ? {} : { headWidth: sizes.headWidth }),
      ...(sizes.headLength === null ? {} : { headLength: sizes.headLength }),
      ...(sizes.tailWidth === null ? {} : { tailWidth: sizes.tailWidth }),
      ...(sizes.tailLength === null ? {} : { tailLength: sizes.tailLength }),
    }
  }
  let effects: PaintEffects | undefined
  let hasEffects = false
  for (const source of sources) {
    const properties = propertiesOf(source)
    const list = paintChild(source.children, properties, "a:effectLst")
    if (list !== undefined) effects = paintEffects(source.children, list, palette)
    if (list !== undefined || paintChild(source.children, properties, "a:effectDag") !== undefined) {
      hasEffects = true
      break
    }
  }
  if (!hasEffects && themeSource !== null) {
    const style = styleOf("a:effectRef", styles?.effects ?? [])
    const list = paintChild(themeSource.children, style?.element, "a:effectLst")
    if (style !== null && list !== undefined) effects = paintEffects(themeSource.children, list, style.palette)
  }
  let geometry: string | null = null
  const adjusts: Record<string, number> = {}
  for (const source of sources) {
    const properties = propertiesOf(source)
    const preset = paintChild(source.children, properties, "a:prstGeom")
    if (preset !== undefined) {
      geometry = paintAttribute(preset, "prst")
      const list = paintChild(source.children, preset, "a:avLst")
      for (const guide of list === undefined ? [] : (source.children[list.index] ?? [])) {
        const name = paintAttribute(guide, "name")
        const formula = paintAttribute(guide, "fmla")
        if (guide.kind !== "a:gd" || name === null || formula === null || !/^val [+-]?\d+$/.test(formula)) continue
        const value = Number(formula.slice(4))
        if (Number.isSafeInteger(value))
          Object.defineProperty(adjusts, name, { value, enumerable: true, configurable: true })
      }
      break
    }
    if (paintChild(source.children, properties, "a:custGeom") !== undefined) {
      geometry = "custom"
      break
    }
  }
  return { fill, line, geometry, adjusts, ...(effects === undefined ? {} : { effects }) }
}
