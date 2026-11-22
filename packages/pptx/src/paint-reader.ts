import { labelOf, type PaintLabel } from "./paint-label.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { partOf, presentationPart, relsOf } from "./package-address.js"
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
import { paintShape, type PaintSource, type PaintStyles, type ShapePaint } from "./paint-shape.js"
import { standPaint } from "./stand-paint.js"
import { addedPicturePart } from "./picture-write.js"
import { paintContentType, paintImage, paintPictureFill, type PaintImage, type PaintPicture } from "./paint-image.js"
import type { ShapeKind } from "./shape-tree.js"
import {
  attr,
  boxOf,
  extent,
  finalPlacement,
  layoutMatch,
  masterMatch,
  slidePlacement,
  sheetFrom,
  type Sheet,
  type Drawn,
} from "./paint-sheet.js"
import { markupChildren } from "./text-value-route.js"
import { placeholderPrompt } from "./placeholder-prompt.js"
import { paintDiagram } from "./paint-diagram.js"
import { frameChart, type PaintChart } from "./paint-chart.js"
import { paintConnection, type PaintConnection } from "./paint-connection.js"

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
  image: PaintImage | null
  box: PaintBox | null
  group: string | null
  placeholder: { type: string; index: number | null } | null
  prompt?: string | null
  text: PaintText | null
  diagram?: readonly PaintElement[]
  chart?: PaintChart
  connection?: PaintConnection
} & ShapePaint &
  PaintLabel

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

type Above = {
  readonly sheet: Sheet
  readonly painted: readonly Omit<PaintElement, keyof ShapePaint>[]
}

const slideName = /^ppt\/slides\/[^/]+\.xml$/

const shownAbove = (sheet: Sheet): readonly Drawn[] =>
  sheet.drawn.filter((item) => !item.hidden && item.placeholder === null)

const paintedAbove = (
  sheet: Sheet,
  from: "layout" | "master",
  image: (sheet: Sheet, item: Drawn) => PaintImage | null,
): readonly Omit<PaintElement, keyof ShapePaint>[] =>
  shownAbove(sheet).map((item) => ({
    part: sheet.part,
    shape: item.shape,
    from,
    kind: item.kind,
    image: image(sheet, item),
    box: boxOf(finalPlacement(item)),
    group: item.group,
    placeholder: null,
    prompt: null,
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

export type PaintReaderOptions = {
  readonly fallbackPrompt?: (type: string | null | undefined) => string | null
}

export function paintReader(parts: ReadonlyMap<string, Uint8Array>, options?: PaintReaderOptions): PaintReader {
  const contentType = paintContentType(parts)
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
    const bytes = parts.get(relsOf(part))
    const items = bytes === undefined ? [] : markupDocument(bytes).elements
    for (const item of items) {
      const type = attr(item, "Type")
      const target = attr(item, "Target")
      if (item.kind !== "Relationship" || type === null || target === null) continue
      if (attr(item, "TargetMode") === "External") continue
      const resolved = partOf(part, target)
      const name = type.split("/").pop() ?? ""
      if (!targets.has(name)) targets.set(name, resolved)
      const id = attr(item, "Id")
      if (id !== null) targets.set(`id:${id}`, resolved)
    }
    relationships.set(part, targets)
    return targets
  }

  const picture = (part: string, id: string): ReturnType<PaintPicture> => {
    const target = relationshipsOf(part).get(`id:${id}`)
    const held = target !== undefined && (parts.has(target) || addedPicturePart(target))
    return held ? { part: target, contentType: contentType(target) } : null
  }

  const imageOf = (sheet: Sheet, item: Drawn, palette: PaintPalette | null = null): PaintImage | null =>
    paintImage(
      paintPictureFill(item.element, sheet.elements, sheet.children),
      sheet.children,
      (id) => picture(sheet.part, id),
      palette,
    )

  const sheetAbove = (source: string, type: "slideLayout" | "slideMaster"): Above | null => {
    const part = relationshipsOf(source).get(type)
    if (part === undefined) return null
    const known = above.get(part)
    if (known !== undefined) return known
    const bytes = parts.get(part)
    const sheet = bytes === undefined ? null : sheetFrom(part, bytes)
    const read =
      sheet === null
        ? null
        : { sheet, painted: paintedAbove(sheet, type === "slideLayout" ? "layout" : "master", imageOf) }
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
        effects: entries("a:effectStyleLst"),
      })
    }
    return { theme: theme ?? null, palette }
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
      return drawn === undefined
        ? element
        : {
            ...element,
            text: textOf(drawn, item.sheet, layout, master, () => ({
              ...scope(),
              picture: (id) => picture(item.sheet.part, id),
            })),
          }
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
      const diagramOf = (item: Drawn, box: PaintBox | null): Pick<PaintElement, "diagram"> => {
        const read =
          box === null
            ? null
            : paintDiagram(item, sheet.children, box, parts, (id) => relationshipsOf(slidePart).get(`id:${id}`))
        if (read === null) return {}
        const themeStyles = context.theme === null ? null : (styles.get(context.theme.part) ?? null)
        const diagram = read.shapes.flatMap(({ drawn, box: shapeBox, textBox }, at): PaintElement[] => {
          const source = {
            element: drawn.element,
            children: read.sheet.children,
            part: read.sheet.part,
            groupFill: null,
          }
          const holder = { ...source, bytes: read.sheet.bytes, placeholder: null, above: [] }
          const text = paintText(holder, scope)
          const base = { part: read.sheet.part, from: "slide", kind: drawn.kind, image: null, group: null } as const
          const own: PaintElement = {
            ...base,
            shape: String(at),
            box: shapeBox,
            placeholder: null,
            text: textBox === null ? text : null,
            ...paintShape([source], themeStyles, context.palette, picture),
          }
          if (textBox === null || text === null) return [own]
          const words = { fill: null, line: null, geometry: null, placeholder: null }
          return [own, { ...base, ...words, shape: `${at}.text`, box: textBox, text }]
        })
        return { diagram }
      }
      const charts = {
        parts,
        target: (part: string, id: string) => relationshipsOf(part).get(`id:${id}`),
        colors: (part: string) => relationshipsOf(part).get("chartColorStyle"),
        palette: context.palette,
        fonts: () => scope().fonts,
      }
      const painted = standPaint(sheet.elements, sheet.children, context.palette, sheet.drawn, (item) =>
        paints.get(item)!,
      ).map((item): PaintElement => {
        const box = boxOf(slidePlacement(item, layout?.sheet ?? null, master?.sheet ?? null))
        return {
          part: slidePart,
          shape: item.shape,
          from: "slide",
          kind: item.kind,
          image: imageOf(sheet, item, context.palette),
          box,
          group: item.group,
          placeholder: item.placeholder,
          prompt: placeholderPrompt(item, sheet, layoutSheet, options?.fallbackPrompt),
          text: textOf(item, sheet, layoutSheet, masterSheet, () => ({
            ...scope(),
            picture: (id) => picture(sheet.part, id),
          })),
          ...diagramOf(item, box),
          ...frameChart(item.element, sheet.children, slidePart, charts),
          ...labelOf(item, sheet.children),
          ...paintConnection(item.element, sheet.children),
          ...item.paint,
        }
      })
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
