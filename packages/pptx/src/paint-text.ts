import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintColor, type PaintPalette } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import { defaultColor, highlightOf, linkColor } from "./text-color.js"
import { sourceBody, type MarkupChildren, type SourceParagraph } from "./text-value-route.js"

export type PaintRunStyle = {
  font: string | null
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  baseline: number
  color: PaintColor | null
  highlight: PaintColor | null
}

export type PaintRun = PaintRunStyle & {
  from: number
  kind: "text" | "field" | "break"
  text: string
}

type BulletLook = { font: string | null; color: PaintColor | null; size: number | null }

export type PaintBullet =
  | ({ char: string } & BulletLook)
  | ({ autoNumber: string; start: number; number: number } & BulletLook)

export type PaintSpacing = { percent: number } | { points: number }

export type PaintParagraph = {
  from: number
  align: "left" | "center" | "right" | "justify" | "distributed"
  level: number
  marginLeft: number
  indent: number
  lineSpacing: PaintSpacing | null
  spaceBefore: PaintSpacing | null
  spaceAfter: PaintSpacing | null
  bullet: PaintBullet | null
  runs: readonly PaintRun[]
  endStyle: PaintRunStyle
}

export type PaintText = {
  paragraphs: readonly PaintParagraph[]
  anchor: "top" | "middle" | "bottom"
  insets: { left: number; top: number; right: number; bottom: number }
  wrap: boolean
  fit: "none" | "shrink" | "grow"
  vertical: boolean
  flow: "horz" | "vert" | "vert270"
  columns: number
  columnGap: number
  fontScale: number
  spacingReduction: number
  edgeSpacing?: true
}

export type PaintTextMarkup = {
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
}

export type PaintTextHolder = {
  readonly element: MarkupElement
  readonly children: MarkupChildren
}

export type PaintTextShape = PaintTextHolder & {
  readonly bytes: Uint8Array
  readonly placeholder: string | null
  readonly above: readonly PaintTextHolder[]
  readonly style?: Partial<Pick<PaintRunStyle, "font" | "color" | "bold" | "italic">>
}

export type PaintTextScope = {
  readonly key: string
  readonly palette: PaintPalette
  readonly fonts: ReadonlyMap<string, string>
  readonly styles: PaintTextHolder | null
  readonly defaults: PaintTextHolder | null
}

type Levels = {
  readonly paragraph: readonly PaintTextHolder[]
  readonly nearRuns: readonly PaintTextHolder[]
  readonly farRuns: readonly PaintTextHolder[]
}

type FontReference = {
  readonly font: string | null | undefined
  readonly color: PaintColor | null | undefined
  readonly bold?: boolean
  readonly italic?: boolean
}

type Counted = { readonly scheme: string; readonly start: number; readonly number: number }

const defaultSize = 18
const lastLevel = 8
const titleTypes = new Set(["title", "ctrTitle"])
const bodyTypes = new Set(["body", "subTitle", "obj"])
const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill"])
const bulletKinds = new Set(["a:buNone", "a:buChar", "a:buAutoNum", "a:buBlip"])
const bulletFontKinds = new Set(["a:buFont", "a:buFontTx"])
const bulletColorKinds = new Set(["a:buClr", "a:buClrTx"])
const bulletSizeKinds = new Set(["a:buSzPct", "a:buSzPts", "a:buSzTx"])
const anchors = new Map<string, PaintText["anchor"]>([
  ["t", "top"],
  ["ctr", "middle"],
  ["b", "bottom"],
  ["just", "top"],
  ["dist", "top"],
])
const aligns = new Map<string, PaintParagraph["align"]>([
  ["l", "left"],
  ["ctr", "center"],
  ["r", "right"],
  ["just", "justify"],
  ["justLow", "justify"],
  ["dist", "distributed"],
  ["thaiDist", "distributed"],
])
const fontReference = /^\+m[jn]-(lt|ea|cs)$/

const inside = (holder: PaintTextHolder): readonly MarkupElement[] => holder.children[holder.element.index] ?? []

const held = (holder: PaintTextHolder, kind: string): PaintTextHolder | undefined => {
  const element = paintChild(holder.children, holder.element, kind)
  return element === undefined ? undefined : { element, children: holder.children }
}

const first = <T>(
  layers: readonly PaintTextHolder[],
  read: (layer: PaintTextHolder) => T | undefined,
): T | undefined => {
  for (const layer of layers) {
    const value = read(layer)
    if (value !== undefined) return value
  }
  return undefined
}

const whole = (layer: PaintTextHolder, name: string): number | undefined => {
  const value = paintAttribute(layer.element, name)
  if (value === null || !/^[+-]?\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

const fraction = (layer: PaintTextHolder, name: string): number | undefined => {
  const value = paintAttribute(layer.element, name)
  if (value !== null && /^[+-]?\d+(\.\d+)?%$/.test(value)) return Number(value.slice(0, -1)) / 100
  const number = whole(layer, name)
  return number === undefined ? undefined : number / 100000
}

const flag = (layer: PaintTextHolder, name: string): boolean | undefined => {
  const value = paintAttribute(layer.element, name)
  if (value === "1" || value === "true") return true
  if (value === "0" || value === "false") return false
  return undefined
}

const named = <T>(layer: PaintTextHolder, name: string, values: ReadonlyMap<string, T>): T | undefined =>
  values.get(paintAttribute(layer.element, name) ?? "")

const between = (value: number): number => Math.max(0, Math.min(1, value))

const typeface = (element: MarkupElement, scope: PaintTextScope): string | undefined => {
  const value = paintAttribute(element, "typeface")
  if (value === null || value === "") return undefined
  return fontReference.test(value) ? scope.fonts.get(value) : value
}

const colorOf = (layer: PaintTextHolder, scope: PaintTextScope): PaintColor | null | undefined => {
  if (!inside(layer).some((element) => fillKinds.has(element.kind))) return undefined
  const fill = paintFill(layer.element, layer.children, scope.palette, () => null)
  if (fill === null) return null
  if (fill.type === "solid") return fill.color
  if (fill.type === "gradient") return fill.stops[0]?.color ?? null
  return fill.type === "pattern" ? fill.foreground : null
}

const fontOf = (layer: PaintTextHolder, scope: PaintTextScope): string | undefined => {
  const latin = paintChild(layer.children, layer.element, "a:latin")
  return latin === undefined ? undefined : typeface(latin, scope)
}

const sizeOf = (layer: PaintTextHolder): number | undefined => {
  const value = whole(layer, "sz")
  return value === undefined || value <= 0 ? undefined : value / 100
}

const presence = (layer: PaintTextHolder, name: string, off: string): boolean | undefined => {
  const value = paintAttribute(layer.element, name)
  return value === null ? undefined : value !== off
}

const referenceOf = (shape: PaintTextShape, scope: PaintTextScope): FontReference => {
  const style = held(shape, "p:style")
  const reference = style === undefined ? undefined : held(style, "a:fontRef")
  if (reference === undefined) return { font: undefined, color: undefined }
  const index = paintAttribute(reference.element, "idx")
  const color = inside(reference)[0]
  return {
    font: index === "major" ? scope.fonts.get("+mj-lt") : index === "minor" ? scope.fonts.get("+mn-lt") : undefined,
    color: color === undefined ? undefined : paintColor(color, reference.children, scope.palette),
  }
}

const runStyle = (
  format: PaintTextHolder | undefined,
  levels: Levels,
  reference: FontReference,
  scope: PaintTextScope,
): PaintRunStyle => {
  const near = format === undefined ? levels.nearRuns : [format, ...levels.nearRuns]
  const all = [...near, ...levels.farRuns]
  const link = linkColor(format, scope)
  const nearColor = first(near, (layer) => colorOf(layer, scope))
  const color =
    link !== undefined
      ? link
      : nearColor !== undefined
        ? nearColor
        : reference.color !== undefined
          ? reference.color
          : first(levels.farRuns, (layer) => colorOf(layer, scope))
  return {
    font:
      first(near, (layer) => fontOf(layer, scope)) ??
      reference.font ??
      first(levels.farRuns, (layer) => fontOf(layer, scope)) ??
      scope.fonts.get("+mn-lt") ??
      null,
    size: first(all, sizeOf) ?? defaultSize,
    bold:
      first(near, (layer) => flag(layer, "b")) ??
      reference.bold ??
      first(levels.farRuns, (layer) => flag(layer, "b")) ??
      false,
    italic:
      first(near, (layer) => flag(layer, "i")) ??
      reference.italic ??
      first(levels.farRuns, (layer) => flag(layer, "i")) ??
      false,
    underline: link !== undefined || (first(all, (layer) => presence(layer, "u", "none")) ?? false),
    strike: first(all, (layer) => presence(layer, "strike", "noStrike")) ?? false,
    baseline: first(all, (layer) => fraction(layer, "baseline")) ?? 0,
    color: color === undefined ? defaultColor(scope) : color,
    highlight: first(all, (layer) => highlightOf(layer, scope)) ?? null,
  }
}

const spacing = (layer: PaintTextHolder, kind: string): PaintSpacing | undefined => {
  const holder = held(layer, kind)
  if (holder === undefined) return undefined
  const share = held(holder, "a:spcPct")
  const percent = share === undefined ? undefined : fraction(share, "val")
  if (percent !== undefined) return { percent }
  const fixed = held(holder, "a:spcPts")
  const points = fixed === undefined ? undefined : whole(fixed, "val")
  return points === undefined ? undefined : { points: points / 100 }
}

const bulletPart = <T>(
  layers: readonly PaintTextHolder[],
  kinds: ReadonlySet<string>,
  read: (part: PaintTextHolder) => T | undefined,
): T | undefined =>
  first(layers, (layer) => {
    const element = inside(layer).find((item) => kinds.has(item.kind))
    return element === undefined ? undefined : read({ element, children: layer.children })
  })

const bulletFont = (part: PaintTextHolder, scope: PaintTextScope): string | null =>
  part.element.kind === "a:buFont" ? (typeface(part.element, scope) ?? null) : null

const bulletColor = (part: PaintTextHolder, scope: PaintTextScope): PaintColor | null => {
  const color = part.element.kind === "a:buClr" ? inside(part)[0] : undefined
  return color === undefined ? null : paintColor(color, part.children, scope.palette)
}

const bulletSize = (part: PaintTextHolder): number | null =>
  part.element.kind === "a:buSzPct" ? (fraction(part, "val") ?? null) : null

const counter = (): ((level: number, scheme: string | null, start: number) => number) => {
  const counts = new Map<number, Counted>()
  return (level, scheme, start) => {
    for (const known of counts.keys()) if (known > level) counts.delete(known)
    if (scheme === null) {
      counts.delete(level)
      return 0
    }
    const previous = counts.get(level)
    const number = previous?.scheme === scheme && previous.start === start ? previous.number + 1 : start
    counts.set(level, { scheme, start, number })
    return number
  }
}

const bulletOf = (
  layers: readonly PaintTextHolder[],
  level: number,
  count: ReturnType<typeof counter>,
  scope: PaintTextScope,
): PaintBullet | null => {
  const part = bulletPart(layers, bulletKinds, (found) => {
    if (found.element.kind === "a:buChar" && paintAttribute(found.element, "char") === null) return undefined
    if (found.element.kind === "a:buAutoNum" && paintAttribute(found.element, "type") === null) return undefined
    return found
  })
  const scheme = part?.element.kind === "a:buAutoNum" ? paintAttribute(part.element, "type") : null
  const start = part === undefined ? 1 : (whole(part, "startAt") ?? 1)
  const number = count(level, scheme, start)
  if (part === undefined || (scheme === null && part.element.kind !== "a:buChar")) return null
  const look = {
    font: bulletPart(layers, bulletFontKinds, (found) => bulletFont(found, scope)) ?? null,
    color: bulletPart(layers, bulletColorKinds, (found) => bulletColor(found, scope)) ?? null,
    size: bulletPart(layers, bulletSizeKinds, bulletSize) ?? null,
  }
  return scheme === null
    ? { char: paintAttribute(part.element, "char") ?? "", ...look }
    : { autoNumber: scheme, start, number, ...look }
}

const bodyOf = (shape: PaintTextHolder): PaintTextHolder | undefined =>
  held(shape, "p:txBody") ?? held(shape, "a:txBody")

const listOf = (shape: PaintTextHolder): PaintTextHolder | undefined => {
  const body = bodyOf(shape)
  return body === undefined ? undefined : held(body, "a:lstStyle")
}

const styledByMaster = (placeholder: string | null): boolean =>
  placeholder !== null && (titleTypes.has(placeholder) || bodyTypes.has(placeholder))

const stylesFor = (placeholder: string | null, styles: PaintTextHolder | null): PaintTextHolder | undefined => {
  if (styles === null) return undefined
  if (placeholder !== null && titleTypes.has(placeholder)) return held(styles, "p:titleStyle")
  if (placeholder !== null && bodyTypes.has(placeholder)) return held(styles, "p:bodyStyle")
  return held(styles, "p:otherStyle")
}

const present = <T>(items: readonly (T | undefined | null)[]): readonly T[] =>
  items.filter((item): item is T => item !== undefined && item !== null)

const listLevel = (list: PaintTextHolder, level: number): readonly PaintTextHolder[] =>
  present([held(list, `a:lvl${level + 1}pPr`), held(list, "a:defPPr")])

const runDefaults = (layers: readonly PaintTextHolder[]): readonly PaintTextHolder[] =>
  present(layers.map((layer) => held(layer, "a:defRPr")))

const levelOf = (properties: PaintTextHolder | undefined): number => {
  const level = properties === undefined ? undefined : whole(properties, "lvl")
  return level === undefined || level < 0 || level > lastLevel ? 0 : level
}

const textFrame = (
  shape: PaintTextShape,
): Pick<
  PaintText,
  | "anchor"
  | "insets"
  | "wrap"
  | "fit"
  | "vertical"
  | "flow"
  | "columns"
  | "columnGap"
  | "fontScale"
  | "spacingReduction"
  | "edgeSpacing"
> => {
  const frames = present(
    [shape, ...shape.above].map((holder) => {
      const body = bodyOf(holder)
      return body === undefined ? undefined : held(body, "a:bodyPr")
    }),
  )
  const fit = first(frames, (frame) =>
    inside(frame).find((item) => ["a:noAutofit", "a:normAutofit", "a:spAutoFit"].includes(item.kind))
      ? (held(frame, "a:normAutofit") ?? null)
      : undefined,
  )
  const fits = new Map<string, PaintText["fit"]>([
    ["a:noAutofit", "none"],
    ["a:normAutofit", "shrink"],
    ["a:spAutoFit", "grow"],
  ])
  const mode = first(frames, (frame) => fits.get(inside(frame).find((item) => fits.has(item.kind))?.kind ?? ""))
  const inset = (name: string, standard: number) => first(frames, (frame) => whole(frame, name)) ?? standard
  const wraps = new Map([
    ["square", true],
    ["none", false],
  ])
  const vert = first(frames, (frame) => paintAttribute(frame.element, "vert") ?? undefined) ?? "horz"
  return {
    anchor: first(frames, (frame) => named(frame, "anchor", anchors)) ?? "top",
    insets: {
      left: inset("lIns", 91440),
      top: inset("tIns", 45720),
      right: inset("rIns", 91440),
      bottom: inset("bIns", 45720),
    },
    wrap: first(frames, (frame) => named(frame, "wrap", wraps)) ?? true,
    fit: mode ?? "none",
    vertical: vert !== "horz",
    flow: vert === "horz" ? "horz" : vert === "vert270" ? "vert270" : "vert",
    columns: Math.min(Math.max(first(frames, (frame) => whole(frame, "numCol")) ?? 1, 1), 16),
    columnGap: Math.max(first(frames, (frame) => whole(frame, "spcCol")) ?? 0, 0),
    fontScale: between((fit === undefined || fit === null ? undefined : fraction(fit, "fontScale")) ?? 1),
    spacingReduction: between((fit === undefined || fit === null ? undefined : fraction(fit, "lnSpcReduction")) ?? 0),
    ...(first(frames, (frame) => flag(frame, "spcFirstLastPara")) === true ? { edgeSpacing: true } : {}),
  }
}

const textParagraph = (
  shape: PaintTextShape,
  source: SourceParagraph,
  from: number,
  levelsAt: (properties: PaintTextHolder | undefined, level: number) => Levels,
  count: ReturnType<typeof counter>,
  reference: FontReference,
  scope: PaintTextScope,
): PaintParagraph => {
  const owned = (element: MarkupElement | undefined): PaintTextHolder | undefined =>
    element === undefined ? undefined : { element, children: shape.children }
  const properties = owned(source.properties)
  const level = levelOf(properties)
  const levels = levelsAt(properties, level)
  const layers = levels.paragraph
  return {
    from,
    align: first(layers, (layer) => named(layer, "algn", aligns)) ?? "left",
    level,
    marginLeft: first(layers, (layer) => whole(layer, "marL")) ?? 0,
    indent: first(layers, (layer) => whole(layer, "indent")) ?? 0,
    lineSpacing: first(layers, (layer) => spacing(layer, "a:lnSpc")) ?? null,
    spaceBefore: first(layers, (layer) => spacing(layer, "a:spcBef")) ?? null,
    spaceAfter: first(layers, (layer) => spacing(layer, "a:spcAft")) ?? null,
    bullet: bulletOf(layers, level, count, scope),
    runs: source.inlines.map((inline, run) => ({
      from: run,
      kind: inline.element.kind === "a:br" ? "break" : inline.element.kind === "a:fld" ? "field" : "text",
      text: inline.text,
      ...runStyle(owned(inline.format), levels, reference, scope),
    })),
    endStyle: runStyle(owned(source.end), levels, reference, scope),
  }
}

const resolvedText = (shape: PaintTextShape, source: readonly SourceParagraph[], scope: PaintTextScope): PaintText => {
  const nearLists = present([shape, ...shape.above].map(listOf))
  const farLists = present([
    stylesFor(shape.placeholder, scope.styles),
    styledByMaster(shape.placeholder) ? null : scope.defaults,
  ])
  const known = new Map<number, Pick<Levels, "nearRuns" | "farRuns"> & { lists: readonly PaintTextHolder[] }>()
  const levelsAt = (properties: PaintTextHolder | undefined, level: number): Levels => {
    let lists = known.get(level)
    if (lists === undefined) {
      const near = nearLists.flatMap((list) => listLevel(list, level))
      const far = farLists.flatMap((list) => listLevel(list, level))
      lists = { lists: [...near, ...far], nearRuns: runDefaults(near), farRuns: runDefaults(far) }
      known.set(level, lists)
    }
    if (properties === undefined) return { paragraph: lists.lists, nearRuns: lists.nearRuns, farRuns: lists.farRuns }
    return {
      paragraph: [properties, ...lists.lists],
      nearRuns: [...runDefaults([properties]), ...lists.nearRuns],
      farRuns: lists.farRuns,
    }
  }
  const count = counter()
  const reference = { ...referenceOf(shape, scope), ...shape.style }
  return {
    paragraphs: source.map((paragraph, from) =>
      textParagraph(shape, paragraph, from, levelsAt, count, reference, scope),
    ),
    ...textFrame(shape),
  }
}

export const paintText = (shape: PaintTextShape, scope: () => PaintTextScope): PaintText | null => {
  const source = sourceBody(shape.children, shape.bytes, shape.element)
  return source === null || source.length === 0 ? null : resolvedText(shape, source, scope())
}

export { paintTextMapping, paintTextScope } from "./paint-text-scope.js"
