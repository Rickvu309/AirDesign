import { markupDocument, type MarkupElement } from "./element-span.js"
import { paintColor, type PaintFill, type PaintPalette } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import {
  paintText,
  paintTextMapping,
  paintTextScope,
  type PaintText,
  type PaintTextHolder,
  type PaintTextScope,
} from "./paint-text.js"
import { paintShape, type PaintLine, type PaintSource, type PaintStyles, type ShapePaint } from "./paint-shape.js"
import type { ShapeKind } from "./read-shapes.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type PaintBox = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipH: boolean
  flipV: boolean
}

export type PaintElement = {
  part: string
  shape: string
  from: "slide" | "layout" | "master"
  kind: ShapeKind
  box: PaintBox | null
  group: string | null
  placeholder: { type: string; index: number | null } | null
  text: PaintText | null
  fill: PaintFill | null
  line: PaintLine | null
  geometry: string | null
}

export type SlidePaint = {
  width: number
  height: number
  elements: readonly PaintElement[]
  background: PaintFill | null
}

export type PaintReader = { slide(slidePart: string): SlidePaint }

export class PaintPartError extends Error {
  readonly part: string

  constructor(part: string) {
    super(`paint part ${part}`)
    this.name = "PaintPartError"
    this.part = part
  }
}

type Placeholder = NonNullable<PaintElement["placeholder"]>

type Placement = {
  readonly centreX: number
  readonly centreY: number
  readonly width: number
  readonly height: number
  readonly turn: number
  readonly flipH: boolean
  readonly flipV: boolean
}

type GroupFrame = {
  readonly offX: number
  readonly offY: number
  readonly childX: number
  readonly childY: number
  readonly scaleX: number
  readonly scaleY: number
  readonly centreX: number
  readonly centreY: number
  readonly turn: number
  readonly cos: number
  readonly sin: number
  readonly flipH: boolean
  readonly flipV: boolean
}

type Frames = { readonly frame: GroupFrame | null; readonly outer: Frames | null }

type Own = Placement | "missing" | "malformed"

type Drawn = {
  readonly element: MarkupElement
  readonly shape: string
  readonly kind: ShapeKind
  readonly hidden: boolean
  readonly group: string | null
  readonly frames: Frames | null
  readonly own: Own
  readonly placeholder: Placeholder | null
}

type Sheet = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
  readonly part: string
  readonly showsMaster: boolean
  readonly drawn: readonly Drawn[]
}

type Visit = {
  readonly element: MarkupElement
  readonly hidden: boolean
  readonly group: string | null
  readonly frames: Frames | null
}

type Above = {
  readonly sheet: Sheet
  readonly painted: readonly Omit<PaintElement, keyof ShapePaint>[]
}

const presentationPart = "ppt/presentation.xml"
const slideName = /^ppt\/slides\/[^/]+\.xml$/
const wholeNumber = /^[+-]?\d+$/
const fullTurn = 21_600_000
const turnsPerDegree = 60_000
const omittedType = "obj"
const nonVisualKinds: Record<ShapeKind, string> = {
  "p:sp": "p:nvSpPr",
  "p:pic": "p:nvPicPr",
  "p:graphicFrame": "p:nvGraphicFramePr",
  "p:cxnSp": "p:nvCxnSpPr",
  "p:grpSp": "p:nvGrpSpPr",
}
const masterTypes = new Map([
  ["ctrTitle", "title"],
  ["subTitle", "body"],
  [omittedType, "body"],
])

const shapeKind = (kind: string): kind is ShapeKind => Object.hasOwn(nonVisualKinds, kind)

const attr = (element: MarkupElement, name: string): string | null => {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

const childOf = (children: MarkupChildren, parent: MarkupElement, kind: string): MarkupElement | undefined =>
  children[parent.index]?.find((item) => item.kind === kind)

const sizeOf = (children: MarkupChildren, parent: MarkupElement): MarkupElement | undefined =>
  children[parent.index]?.find((item) => item.kind === "a:ext" && attr(item, "cx") !== null)

const integer = (value: string | null): number | null => {
  if (value === null || !wholeNumber.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

const extent = (value: string | null): number | null => {
  const number = integer(value)
  return number === null || number < 0 ? null : number
}

const isTrue = (value: string | null): boolean => value === "1" || value === "true"

const isFalse = (value: string | null): boolean => value === "0" || value === "false"

const angle = (element: MarkupElement): number | null => {
  const value = attr(element, "rot")
  return value === null ? 0 : integer(value)
}

const transformOf = (children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined => {
  if (shape.kind === "p:graphicFrame") return childOf(children, shape, "p:xfrm")
  const holder = childOf(children, shape, shape.kind === "p:grpSp" ? "p:grpSpPr" : "p:spPr")
  return holder === undefined ? undefined : childOf(children, holder, "a:xfrm")
}

const ownPlacement = (children: MarkupChildren, xfrm: MarkupElement | undefined): Own => {
  if (xfrm === undefined) return "missing"
  const off = childOf(children, xfrm, "a:off")
  const ext = sizeOf(children, xfrm)
  if (off === undefined || ext === undefined) return "missing"
  const x = integer(attr(off, "x"))
  const y = integer(attr(off, "y"))
  const width = extent(attr(ext, "cx"))
  const height = extent(attr(ext, "cy"))
  const turn = angle(xfrm)
  if (x === null || y === null || width === null || height === null || turn === null) return "malformed"
  return {
    centreX: x + width / 2,
    centreY: y + height / 2,
    width,
    height,
    turn,
    flipH: isTrue(attr(xfrm, "flipH")),
    flipV: isTrue(attr(xfrm, "flipV")),
  }
}

const groupFrame = (children: MarkupChildren, xfrm: MarkupElement): GroupFrame | null => {
  const off = childOf(children, xfrm, "a:off")
  const ext = sizeOf(children, xfrm)
  const childOff = childOf(children, xfrm, "a:chOff")
  const childExt = childOf(children, xfrm, "a:chExt")
  if (off === undefined || ext === undefined || childOff === undefined || childExt === undefined) return null
  const offX = integer(attr(off, "x"))
  const offY = integer(attr(off, "y"))
  const width = extent(attr(ext, "cx"))
  const height = extent(attr(ext, "cy"))
  const childX = integer(attr(childOff, "x"))
  const childY = integer(attr(childOff, "y"))
  const childWidth = extent(attr(childExt, "cx"))
  const childHeight = extent(attr(childExt, "cy"))
  const turn = angle(xfrm)
  if (offX === null || offY === null || width === null || height === null) return null
  if (childX === null || childY === null || childWidth === null || childHeight === null) return null
  if (turn === null) return null
  const radians = (turn / turnsPerDegree) * (Math.PI / 180)
  return {
    offX,
    offY,
    childX,
    childY,
    scaleX: childWidth === 0 ? 1 : width / childWidth,
    scaleY: childHeight === 0 ? 1 : height / childHeight,
    centreX: offX + width / 2,
    centreY: offY + height / 2,
    turn,
    cos: Math.cos(radians),
    sin: Math.sin(radians),
    flipH: isTrue(attr(xfrm, "flipH")),
    flipV: isTrue(attr(xfrm, "flipV")),
  }
}

const framesInside = (
  children: MarkupChildren,
  xfrm: MarkupElement | undefined,
  outer: Frames | null,
): Frames | null => {
  if (xfrm === undefined || (children[xfrm.index] ?? []).length === 0) return outer
  return { frame: groupFrame(children, xfrm), outer }
}

const throughFrame = (frame: GroupFrame, place: Placement): Placement => {
  const scaledX = frame.offX + (place.centreX - frame.childX) * frame.scaleX
  const scaledY = frame.offY + (place.centreY - frame.childY) * frame.scaleY
  const fromCentreX = (frame.flipH ? 2 * frame.centreX - scaledX : scaledX) - frame.centreX
  const fromCentreY = (frame.flipV ? 2 * frame.centreY - scaledY : scaledY) - frame.centreY
  return {
    centreX: frame.centreX + fromCentreX * frame.cos - fromCentreY * frame.sin,
    centreY: frame.centreY + fromCentreX * frame.sin + fromCentreY * frame.cos,
    width: place.width * frame.scaleX,
    height: place.height * frame.scaleY,
    turn: (frame.flipH !== frame.flipV ? -place.turn : place.turn) + frame.turn,
    flipH: place.flipH !== frame.flipH,
    flipV: place.flipV !== frame.flipV,
  }
}

const throughFrames = (place: Placement, frames: Frames | null): Placement | null => {
  let placed = place
  for (let at = frames; at !== null; at = at.outer) {
    if (at.frame === null) return null
    placed = throughFrame(at.frame, placed)
  }
  return placed
}

const boxOf = (place: Placement | null): PaintBox | null => {
  if (place === null) return null
  const x = place.centreX - place.width / 2
  const y = place.centreY - place.height / 2
  if (![x, y, place.width, place.height].every(Number.isFinite)) return null
  return {
    x,
    y,
    width: place.width,
    height: place.height,
    rotation: (((place.turn % fullTurn) + fullTurn) % fullTurn) / turnsPerDegree,
    flipH: place.flipH,
    flipV: place.flipV,
  }
}

const placeholderOf = (children: MarkupChildren, nonVisual: MarkupElement | undefined): Placeholder | null => {
  const application = nonVisual === undefined ? undefined : childOf(children, nonVisual, "p:nvPr")
  const placeholder = application === undefined ? undefined : childOf(children, application, "p:ph")
  if (placeholder === undefined) return null
  return { type: attr(placeholder, "type") ?? omittedType, index: integer(attr(placeholder, "idx")) }
}

const drawnIn = (elements: readonly MarkupElement[], children: MarkupChildren): readonly Drawn[] => {
  const root = elements[0]
  const body = root === undefined ? undefined : childOf(children, root, "p:cSld")
  const tree = body === undefined ? undefined : childOf(children, body, "p:spTree")
  if (tree === undefined) return []
  const drawn: Drawn[] = []
  const visits: Visit[] = []
  const visitInside = (parent: MarkupElement, visit: Omit<Visit, "element">) => {
    const inside = children[parent.index] ?? []
    for (let at = inside.length - 1; at >= 0; at -= 1) {
      const element = inside[at]
      if (element !== undefined) visits.push({ ...visit, element })
    }
  }
  visitInside(tree, { hidden: false, group: null, frames: null })
  for (let visit = visits.pop(); visit !== undefined; visit = visits.pop()) {
    const { element } = visit
    if (element.kind === "mc:AlternateContent") {
      const choice = childOf(children, element, "mc:Choice")
      if (choice !== undefined) visitInside(choice, visit)
      continue
    }
    if (!shapeKind(element.kind)) continue
    const nonVisual = childOf(children, element, nonVisualKinds[element.kind])
    const identity = nonVisual === undefined ? undefined : childOf(children, nonVisual, "p:cNvPr")
    if (identity === undefined || identity.id === null) continue
    const hidden = visit.hidden || isTrue(attr(identity, "hidden"))
    const xfrm = transformOf(children, element)
    drawn.push({
      element,
      shape: identity.id,
      kind: element.kind,
      hidden,
      group: visit.group,
      frames: visit.frames,
      own: ownPlacement(children, xfrm),
      placeholder: placeholderOf(children, nonVisual),
    })
    if (element.kind === "p:grpSp") {
      visitInside(element, { hidden, group: identity.id, frames: framesInside(children, xfrm, visit.frames) })
    }
  }
  return drawn
}

const finalPlacement = (item: Drawn): Placement | null =>
  typeof item.own === "string" ? null : throughFrames(item.own, item.frames)

const targetPart = (source: string, target: string): string => {
  const path = target.startsWith("/") ? [] : source.split("/").slice(0, -1)
  for (const segment of target.split("/")) {
    if (segment === "..") path.pop()
    else if (segment !== "." && segment !== "") path.push(segment)
  }
  return path.join("/")
}

const relsPart = (part: string): string => {
  const path = part.split("/")
  const name = path.pop() ?? ""
  return [...path, "_rels", `${name}.rels`].join("/")
}

const masterType = (type: string): string => masterTypes.get(type) ?? type

const layoutMatch = (layout: Sheet, wanted: Placeholder): Drawn | undefined => {
  const byIndex =
    wanted.index === null ? undefined : layout.drawn.find((item) => item.placeholder?.index === wanted.index)
  return byIndex ?? layout.drawn.find((item) => item.placeholder?.type === wanted.type)
}

const masterMatch = (master: Sheet, wanted: Placeholder): Drawn | undefined =>
  master.drawn.find(
    (item) => item.placeholder !== null && masterType(item.placeholder.type) === masterType(wanted.type),
  )

const inheritedPlacement = (wanted: Placeholder, layout: Sheet | null, master: Sheet | null): Placement | null => {
  const above = layout === null ? undefined : layoutMatch(layout, wanted)
  const placed = above === undefined ? null : finalPlacement(above)
  if (placed !== null) return placed
  const base = master === null ? undefined : masterMatch(master, above?.placeholder ?? wanted)
  return base === undefined ? null : finalPlacement(base)
}

const slidePlacement = (item: Drawn, layout: Sheet | null, master: Sheet | null): Placement | null => {
  if (item.own === "malformed") return null
  if (item.own !== "missing") return throughFrames(item.own, item.frames)
  if (item.placeholder === null) return null
  const inherited = inheritedPlacement(item.placeholder, layout, master)
  return inherited === null ? null : throughFrames(inherited, item.frames)
}

const sheetFrom = (part: string, bytes: Uint8Array): Sheet => {
  const { elements } = markupDocument(bytes)
  const root = elements[0]
  const children = markupChildren(elements)
  return {
    bytes,
    elements,
    children,
    part,
    showsMaster: root === undefined || !isFalse(attr(root, "showMasterSp")),
    drawn: drawnIn(elements, children),
  }
}

const shownAbove = (sheet: Sheet): readonly Drawn[] =>
  sheet.drawn.filter((item) => !item.hidden && item.placeholder === null)

const paintedAbove = (sheet: Sheet, from: "layout" | "master"): readonly Omit<PaintElement, keyof ShapePaint>[] =>
  shownAbove(sheet).map((item) => ({
    part: sheet.part,
    shape: item.shape,
    from,
    kind: item.kind,
    box: boxOf(finalPlacement(item)),
    group: item.group,
    placeholder: null,
    text: null,
  }))

const holderOf = (item: Drawn | undefined, sheet: Sheet | null): readonly PaintTextHolder[] =>
  item === undefined || sheet === null ? [] : [{ element: item.element, children: sheet.children }]

const textOf = (
  item: Drawn,
  sheet: Sheet,
  layout: Sheet | null,
  master: Sheet | null,
  scope: () => PaintTextScope,
): PaintText | null => {
  const wanted = item.placeholder
  const above = wanted === null || layout === null ? undefined : layoutMatch(layout, wanted)
  const line = above?.placeholder ?? wanted
  const base = line === null || master === null ? undefined : masterMatch(master, line)
  return paintText(
    {
      element: item.element,
      children: sheet.children,
      bytes: sheet.bytes,
      placeholder: line?.type ?? null,
      above: [...holderOf(above, layout), ...holderOf(base, master)],
    },
    scope,
  )
}

export function paintReader(parts: ReadonlyMap<string, Uint8Array>): PaintReader {
  const relationships = new Map<string, ReadonlyMap<string, string>>()
  const above = new Map<string, Above | null>()
  const themes = new Map<string, Sheet | null>()
  const scopes = new Map<string, PaintTextScope>()
  const textedAbove = new Map<string, readonly Omit<PaintElement, keyof ShapePaint>[]>()
  const styles = new Map<string, PaintStyles>()
  let size: { readonly width: number; readonly height: number } | null = null
  let presentation: Pick<Sheet, "elements" | "children"> | null | undefined

  const presentationMarkup = (): Pick<Sheet, "elements" | "children"> | null => {
    if (presentation !== undefined) return presentation
    const bytes = parts.get(presentationPart)
    const elements = bytes === undefined ? null : markupDocument(bytes).elements
    presentation = elements === null ? null : { elements, children: markupChildren(elements) }
    return presentation
  }

  const slideSize = (): { readonly width: number; readonly height: number } => {
    if (size !== null) return size
    const element = presentationMarkup()?.elements.find((e) => e.kind === "p:sldSz")
    size = {
      width: element === undefined ? 0 : (extent(attr(element, "cx")) ?? 0),
      height: element === undefined ? 0 : (extent(attr(element, "cy")) ?? 0),
    }
    return size
  }

  const relationshipsOf = (part: string): ReadonlyMap<string, string> => {
    const known = relationships.get(part)
    if (known !== undefined) return known
    const targets = new Map<string, string>()
    const bytes = parts.get(relsPart(part))
    const items = bytes === undefined ? [] : markupDocument(bytes).elements
    for (const item of items) {
      const type = attr(item, "Type")
      const target = attr(item, "Target")
      if (item.kind !== "Relationship" || type === null || target === null) continue
      if (attr(item, "TargetMode") === "External") continue
      const name = type.split("/").pop() ?? ""
      if (!targets.has(name)) targets.set(name, targetPart(part, target))
      const id = attr(item, "Id")
      if (id !== null) targets.set(`id:${id}`, targetPart(part, target))
    }
    relationships.set(part, targets)
    return targets
  }

  const sheetAbove = (source: string, type: "slideLayout" | "slideMaster"): Above | null => {
    const part = relationshipsOf(source).get(type)
    if (part === undefined) return null
    const known = above.get(part)
    if (known !== undefined) return known
    const bytes = parts.get(part)
    const sheet = bytes === undefined ? null : sheetFrom(part, bytes)
    const read =
      sheet === null ? null : { sheet, painted: paintedAbove(sheet, type === "slideLayout" ? "layout" : "master") }
    above.set(part, read)
    return read
  }

  const knownSlide = (part: string, bytes: Uint8Array): boolean =>
    slideName.test(part) || markupDocument(bytes).elements[0]?.kind === "p:sld"

  const paletteOf = (sheet: Sheet, layout: Sheet | null, master: Sheet | null) => {
    const themePart = master === null ? undefined : relationshipsOf(master.part).get("theme")
    let theme = themePart === undefined ? null : themes.get(themePart)
    if (theme === undefined && themePart !== undefined) {
      const bytes = parts.get(themePart)
      theme = bytes === undefined ? null : sheetFrom(themePart, bytes)
      themes.set(themePart, theme)
    }
    const themeChildren = theme?.children ?? []
    const themeElements = paintChild(themeChildren, theme?.elements[0], "a:themeElements")
    const scheme = paintChild(themeChildren, themeElements, "a:clrScheme")
    const slots = new Map(
      (scheme === undefined ? [] : (themeChildren[scheme.index] ?? [])).map((element) => [
        element.kind.slice(2),
        element,
      ]),
    )
    let mapping = new Map<string, string>()
    for (const level of [master, layout, sheet]) {
      if (level === null) continue
      const root = level.elements[0]
      const override = paintChild(level.children, root, "p:clrMapOvr")
      const map =
        level === master
          ? paintChild(level.children, root, "p:clrMap")
          : paintChild(level.children, override, "a:overrideClrMapping")
      if (map !== undefined) mapping = new Map(map.attributes.map((item) => [item.name, item.value]))
    }
    const palette: PaintPalette = { children: themeChildren, slots, mapping, placeholder: null }
    if (theme !== null && theme !== undefined && !styles.has(theme.part)) {
      const format = paintChild(themeChildren, themeElements, "a:fmtScheme")
      const entries = (kind: string) => {
        const list = paintChild(themeChildren, format, kind)
        return list === undefined ? [] : (themeChildren[list.index] ?? [])
      }
      styles.set(theme.part, {
        children: themeChildren,
        part: theme.part,
        fills: entries("a:fillStyleLst"),
        lines: entries("a:lnStyleLst"),
      })
    }
    return { theme: theme ?? null, palette }
  }

  const picture = (part: string, id: string): string | null => {
    const target = relationshipsOf(part).get(`id:${id}`)
    return target !== undefined && parts.has(target) ? target : null
  }

  const backgroundOf = (
    sheet: Sheet,
    layout: Sheet | null,
    master: Sheet | null,
    context: ReturnType<typeof paletteOf>,
  ): PaintFill | null => {
    let owner: Sheet | null = null
    let background: MarkupElement | undefined
    for (const level of [sheet, layout, master]) {
      if (level === null) continue
      const body = paintChild(level.children, level.elements[0], "p:cSld")
      background = paintChild(level.children, body, "p:bg")
      if (background !== undefined) {
        owner = level
        break
      }
    }
    if (owner === null || background === undefined) return null
    const { theme } = context
    let { palette } = context
    const themeChildren = theme?.children ?? []
    const themeElements = paintChild(themeChildren, theme?.elements[0], "a:themeElements")
    const properties = paintChild(owner.children, background, "p:bgPr")
    if (properties !== undefined) return paintFill(properties, owner.children, palette, (id) => picture(owner.part, id))
    const reference = paintChild(owner.children, background, "p:bgRef")
    if (reference === undefined || theme === null || theme === undefined) return null
    const value = attr(reference, "idx")
    if (value === null || !/^\d+$/.test(value)) return null
    const format = paintChild(themeChildren, themeElements, "a:fmtScheme")
    const styles = paintChild(themeChildren, format, "a:bgFillStyleLst")
    const style = styles === undefined ? undefined : themeChildren[styles.index]?.[Number(value) - 1001]
    if (style === undefined) return null
    const color = owner.children[reference.index]?.[0]
    palette = { ...palette, placeholder: color === undefined ? null : paintColor(color, owner.children, palette) }
    return paintFill(style, themeChildren, palette, (id) => picture(theme.part, id), true)
  }

  const themeOf = (master: Sheet | null): Sheet | null => {
    const part = master === null ? undefined : relationshipsOf(master.part).get("theme")
    if (part === undefined) return null
    const known = themes.get(part)
    if (known !== undefined) return known
    const bytes = parts.get(part)
    const read = bytes === undefined ? null : sheetFrom(part, bytes)
    themes.set(part, read)
    return read
  }

  const textScope = (sheet: Sheet, layout: Sheet | null, master: Sheet | null): PaintTextScope => {
    const mapping = paintTextMapping(sheet, layout, master)
    const key = `${master?.part ?? ""} ${[...mapping].join(" ")}`
    const known = scopes.get(key)
    if (known !== undefined) return known
    const read = paintTextScope(key, mapping, themeOf(master), master, presentationMarkup())
    scopes.set(key, read)
    return read
  }

  const withText = (
    item: Above,
    layout: Sheet | null,
    master: Sheet | null,
    scope: () => PaintTextScope,
  ): readonly Omit<PaintElement, keyof ShapePaint>[] => {
    if (item.painted.length === 0) return item.painted
    const key = `${item.sheet.part} ${scope().key}`
    const known = textedAbove.get(key)
    if (known !== undefined) return known
    const shown = shownAbove(item.sheet)
    const read = item.painted.map((element, at) => {
      const drawn = shown[at]
      return drawn === undefined ? element : { ...element, text: textOf(drawn, item.sheet, layout, master, scope) }
    })
    textedAbove.set(key, read)
    return read
  }

  return {
    slide(slidePart: string): SlidePaint {
      const bytes = parts.get(slidePart)
      if (bytes === undefined || !knownSlide(slidePart, bytes)) throw new PaintPartError(slidePart)
      const sheet = sheetFrom(slidePart, bytes)
      const layout = sheetAbove(slidePart, "slideLayout")
      const master = layout === null ? null : sheetAbove(layout.sheet.part, "slideMaster")
      const layoutSheet = layout?.sheet ?? null
      const masterSheet = master?.sheet ?? null
      let known: PaintTextScope | undefined
      const scope = () => (known ??= textScope(sheet, layoutSheet, masterSheet))
      const context = paletteOf(sheet, layoutSheet, masterSheet)
      const paints = new Map<Drawn, ShapePaint>()
      const groups = new Map<Sheet, Map<string, PaintFill | null>>()
      const sourceOf = (owner: Sheet, item: Drawn): PaintSource => ({
        element: item.element,
        children: owner.children,
        part: owner.part,
        groupFill: item.group === null ? null : (groups.get(owner)?.get(item.group) ?? null),
      })
      for (const owner of [masterSheet, layoutSheet, sheet]) {
        if (owner === null) continue
        const fills = new Map<string, PaintFill | null>()
        groups.set(owner, fills)
        for (const item of owner.drawn) {
          const sources = [sourceOf(owner, item)]
          const wanted = item.placeholder
          const above =
            wanted === null || owner !== sheet || layoutSheet === null ? undefined : layoutMatch(layoutSheet, wanted)
          if (above !== undefined && layoutSheet !== null) sources.push(sourceOf(layoutSheet, above))
          const base =
            wanted === null || owner === masterSheet || masterSheet === null
              ? undefined
              : masterMatch(masterSheet, above?.placeholder ?? wanted)
          if (base !== undefined && masterSheet !== null) sources.push(sourceOf(masterSheet, base))
          const paint = paintShape(
            sources,
            context.theme === null ? null : (styles.get(context.theme.part) ?? null),
            context.palette,
            picture,
          )
          paints.set(item, paint)
          fills.set(item.shape, paint.fill)
        }
      }
      const abovePaint = (level: Above, layoutLevel: Sheet | null): readonly PaintElement[] => {
        const texted = withText(level, layoutLevel, masterSheet, scope)
        return shownAbove(level.sheet).map((item, at) => ({ ...texted[at]!, ...paints.get(item)! }))
      }
      const painted = sheet.drawn
        .filter((item) => !item.hidden)
        .map((item): PaintElement => ({
          part: slidePart,
          shape: item.shape,
          from: "slide",
          kind: item.kind,
          box: boxOf(slidePlacement(item, layout?.sheet ?? null, master?.sheet ?? null)),
          group: item.group,
          placeholder: item.placeholder,
          text: textOf(item, sheet, layoutSheet, masterSheet, scope),
          ...paints.get(item)!,
        }))
      const showsLayout = sheet.showsMaster
      const showsMaster = showsLayout && layout !== null && layout.sheet.showsMaster
      return {
        ...slideSize(),
        background: backgroundOf(sheet, layoutSheet, masterSheet, context),
        elements: [
          ...(showsMaster && master !== null ? abovePaint(master, null) : []),
          ...(showsLayout && layout !== null ? abovePaint(layout, layoutSheet) : []),
          ...painted,
        ],
      }
    },
  }
}
