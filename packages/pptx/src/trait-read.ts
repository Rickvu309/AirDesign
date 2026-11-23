import { shownLink } from "./trait-xml-link.js"
import {
  elementId,
  type Box,
  mappedSlots,
  templateColors,
  type Color,
  type DesignKey,
  type ElementId,
  type ElementRead,
  type MappedSlot,
  type Palette,
  type Read,
  type Role,
  type Source,
  type TemplateFont,
  type TemplateColor,
  type TraitReads,
} from "@airdesign/document"
import { readDash } from "./dash-markup.js"
import { colorIn, fillIn, fillKinds, fillOf } from "./color-read.js"
import { child, flag, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { pictureReads } from "./picture-read.js"
import { paintAttribute } from "./paint-color.js"
import {
  layoutMatch,
  masterMatch,
  sheetFrom,
  type Drawn,
  type DrawnShape,
  type ShapeChain,
  type Sheet,
} from "./paint-sheet.js"
import { effectReads, extraEffectReads } from "./effect-reads.js"
import { standRecords } from "./stand-read.js"
import { readSlides } from "./read-shapes.js"
import { referenceOf } from "./style-reference.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import { endOf } from "./trait-xml-connection.js"

export { propertiesOf } from "./shape-properties.js"
import { cornersReads } from "./corners-read.js"
import { propertiesOf } from "./shape-properties.js"

export type DeckTraits = {
  readonly palettes: readonly Palette[]
  readonly slides: ReadonlyMap<string, number>
  readonly elements: ReadonlyMap<ElementId, ElementRead>
}

export type Styles = {
  readonly fills: readonly Held[]
  readonly lines: readonly Held[]
  readonly effects: readonly Held[]
}
type Fonts = ReadonlyMap<TemplateFont, string>
export type Chain = {
  readonly sheet: Sheet
  readonly layout: Sheet | null
  readonly master: Sheet | null
  readonly theme: Sheet | null
}

const roleOf: ReadonlyMap<string, Role> = new Map([
  ["title", "title"],
  ["ctrTitle", "title"],
  ["subTitle", "subtitle"],
  ["body", "body"],
  ["obj", "body"],
  ["dt", "date"],
  ["ftr", "footer"],
  ["sldNum", "number"],
  ["pic", "picture"],
  ["chart", "chart"],
])
const titleTypes = new Set(["title", "ctrTitle"])
const bodyTypes = new Set(["body", "subTitle", "obj"])
const autofits = new Map([
  ["a:normAutofit", "shrink"],
  ["a:spAutoFit", "grow"],
  ["a:noAutofit", "none"],
])
const fontReference = /^\+m([jn])-lt$/
const read = <Value>(value: Value, source: Source | undefined): Read<Value> =>
  source === undefined ? { value } : { value, source }

function shapeReads(
  owners: readonly Held[],
  styles: Styles,
  reads: Partial<Record<DesignKey, Read<unknown>>>,
  kept: DesignKey[],
) {
  const properties = owners.flatMap((owner) => {
    const found = propertiesOf(owner)
    return found === undefined ? [] : [found]
  })
  const geometry = properties.find(
    (held) => child(held, "a:prstGeom") !== undefined || child(held, "a:custGeom") !== undefined,
  )
  if (geometry !== undefined) {
    const preset = child(geometry, "a:prstGeom")
    const name = preset === undefined ? "custom" : paintAttribute(preset.element, "prst")
    if (name === "custom") kept.push("geometry")
    if (name !== null && name !== "rect") reads.geometry = read(name, geometry.source)
  }
  const ownFill = properties.map(fillIn).find((held) => held !== undefined)
  const fillReference = ownFill === undefined ? referenceOf(owners, "a:fillRef", styles.fills) : undefined
  const fill =
    ownFill !== undefined
      ? { held: ownFill, value: fillOf(ownFill, null) }
      : fillReference === undefined || fillReference === "none"
        ? undefined
        : { held: fillReference.entry, value: fillOf(fillReference.entry, fillReference.placed) }
  if (fill !== undefined && fill.value !== null && fill.value !== "none")
    reads.fills = read(fill.value, fill.held.source)
  borderReads(properties, owners, styles, reads)
  effectReads(properties, owners, styles, reads, kept)
}

function borderReads(
  properties: readonly Held[],
  owners: readonly Held[],
  styles: Styles,
  reads: Partial<Record<DesignKey, Read<unknown>>>,
) {
  const lines = properties.flatMap((held) => {
    const line = child(held, "a:ln")
    return line === undefined ? [] : [{ line, placed: null as Color | null }]
  })
  const reference = referenceOf(owners, "a:lnRef", styles.lines)
  if (reference !== undefined && reference !== "none") lines.push({ line: reference.entry, placed: reference.placed })
  if (lines.length === 0) return
  const filled = lines.find(({ line }) => fillIn(line) !== undefined)
  const fill = filled === undefined ? undefined : fillOf(fillIn(filled.line)!, filled.placed)
  if (filled === undefined || fill === undefined || fill === null || fill === "none") return
  reads["border.fill"] = read(fill, filled.line.source)
  const width = lines.find(({ line }) => whole(line.element, "w") !== undefined)
  if (width !== undefined) reads["border.width"] = read(whole(width.line.element, "w")!, width.line.source)
  const ending = (kind: string, name: "border.head" | "border.tail", attribute: string, quiet: string) => {
    const found = lines.find(({ line }) => {
      const held = child(line, kind)
      return held !== undefined && paintAttribute(held.element, attribute) !== null
    })
    const value = found === undefined ? null : paintAttribute(child(found.line, kind)!.element, attribute)
    if (found !== undefined && value !== null && value !== quiet) reads[name] = read(value, found.line.source)
  }
  for (const { line } of lines) {
    const dash = readDash(line)
    if (dash === undefined) continue
    if (dash !== null && dash !== "solid") {
      const value =
        typeof dash === "string" ? dash : dash.custom.flatMap(({ dash, gap }) => [dash / 1000, gap / 1000]).join(", ")
      reads["border.dash"] = read(value, line.source)
    }
    break
  }
  ending("a:headEnd", "border.head", "type", "none")
  ending("a:tailEnd", "border.tail", "type", "none")
}

function connectionReads(slide: string, own: Held, reads: Partial<Record<DesignKey, Read<unknown>>>) {
  const holder = child(child(own, "p:nvCxnSpPr"), "p:cNvCxnSpPr")
  if (holder === undefined) return
  for (const [tag, key] of [
    ["a:stCxn", "connection.start"],
    ["a:endCxn", "connection.end"],
  ] as const) {
    const end = endOf(slide, child(holder, tag)?.element)
    if (!("none" in end)) reads[key] = read(end.shape, undefined)
  }
}

function placedBox(transform: Held): Box | undefined {
  const offset = child(transform, "a:off")?.element
  const extent = child(transform, "a:ext")?.element
  if (offset === undefined || extent === undefined) return undefined
  const [x, y, cx, cy] = [whole(offset, "x"), whole(offset, "y"), whole(extent, "cx"), whole(extent, "cy")]
  if (x === undefined || y === undefined || cx === undefined || cy === undefined || cx < 0 || cy < 0) return undefined
  return { x, y, cx, cy }
}

function transformReads(owners: readonly Held[], reads: Partial<Record<DesignKey, Read<unknown>>>): Box | undefined {
  const transforms = owners.flatMap((owner) => {
    if (!isShapeTag(owner.element.kind)) return []
    const tag = shapeTags[owner.element.kind].transform
    const holder = propertiesOf(owner) ?? owner
    const found = child(holder, tag)
    return found === undefined ? [] : [found]
  })
  const transform = transforms[0]
  if (transform === undefined) return undefined
  const rotation = whole(transform.element, "rot")
  if (rotation !== undefined && rotation !== 0) reads["box.rot"] = read(rotation, transform.source)
  if (flag(transform.element, "flipH") === true) reads["box.flipH"] = read(true, transform.source)
  if (flag(transform.element, "flipV") === true) reads["box.flipV"] = read(true, transform.source)
  return transform.source === undefined ? undefined : placedBox(transform)
}

function bodyReads(owners: readonly Held[], reads: Partial<Record<DesignKey, Read<unknown>>>) {
  if (child(owners[0], "p:txBody") === undefined) return
  const frames = owners.flatMap((owner) => {
    const frame = child(child(owner, "p:txBody"), "a:bodyPr")
    return frame === undefined ? [] : [frame]
  })
  const anchor = frames.find((frame) => paintAttribute(frame.element, "anchor") !== null)
  const anchorValue = anchor === undefined ? null : paintAttribute(anchor.element, "anchor")
  if (anchor !== undefined && anchorValue !== null && anchorValue !== "t")
    reads["body.anchor"] = read(anchorValue, anchor.source)
  const fit = frames.find((frame) => inside(frame).some((item) => autofits.has(item.kind)))
  const fitValue =
    fit === undefined ? undefined : autofits.get(inside(fit).find((item) => autofits.has(item.kind))!.kind)
  if (fit !== undefined && fitValue !== undefined && fitValue !== "none")
    reads["body.autofit"] = read(fitValue, fit.source)
  const vertical = frames.find((frame) => paintAttribute(frame.element, "vert") !== null)
  const verticalValue = vertical === undefined ? null : paintAttribute(vertical.element, "vert")
  if (vertical !== undefined && verticalValue !== null && verticalValue !== "horz")
    reads["body.vertical"] = read(verticalValue, vertical.source)
}

export function listLevels(list: Held | undefined, level: number): readonly Held[] {
  if (list === undefined) return []
  return [child(list, `a:lvl${String(level + 1)}pPr`), child(list, "a:defPPr")].flatMap((held) => {
    const defaults = child(held, "a:defRPr")
    return defaults === undefined ? [] : [defaults]
  })
}

export function textStyleKind(placeholder: string | null): string {
  if (placeholder !== null && titleTypes.has(placeholder)) return "p:titleStyle"
  return placeholder !== null && bodyTypes.has(placeholder) ? "p:bodyStyle" : "p:otherStyle"
}

function textReads(
  owners: readonly Held[],
  placeholder: string | null,
  chain: Chain,
  fonts: Fonts,
  reads: Partial<Record<DesignKey, Read<unknown>>>,
) {
  const own = owners[0]
  const body = child(own, "p:txBody")
  if (own === undefined || body === undefined) return
  const paragraph = inside(body).find((item) => item.kind === "a:p")
  const first = paragraph === undefined ? undefined : { ...body, element: paragraph }
  const properties = child(first, "a:pPr")
  const level = Math.min(Math.max((properties === undefined ? 0 : whole(properties.element, "lvl")) ?? 0, 0), 8)
  const runs = first === undefined ? [] : inside(first).filter((item) => item.kind === "a:r" || item.kind === "a:fld")
  const run = runs[0] === undefined || first === undefined ? undefined : child({ ...first, element: runs[0] }, "a:rPr")
  const near: Held[] = [
    ...(run === undefined ? [] : [run]),
    ...(run === undefined && child(first, "a:endParaRPr") !== undefined ? [child(first, "a:endParaRPr")!] : []),
    ...(child(properties, "a:defRPr") === undefined ? [] : [child(properties, "a:defRPr")!]),
    ...owners.flatMap((owner) => listLevels(child(child(owner, "p:txBody"), "a:lstStyle"), level)),
  ]
  const styles = chain.master === null ? undefined : child(root(chain.master), "p:txStyles")
  const styleList = child(styles, textStyleKind(placeholder))
  const far = listLevels(styleList === undefined ? undefined : { ...styleList, source: "master" }, level)
  const reference = child(child(own, "p:style"), "a:fontRef")
  const size = [...near, ...far].find((held) => (whole(held.element, "sz") ?? 0) > 0)
  if (size !== undefined) reads["text.size"] = read(whole(size.element, "sz")!, size.source)
  const colorHeld = (list: readonly Held[]) =>
    list.find((held) => inside(held).some((item) => fillKinds.has(item.kind)))
  const nearColor = colorHeld(near)
  const referenceColor = reference === undefined ? null : colorIn(reference, null)
  const colored = nearColor ?? (referenceColor !== null ? undefined : colorHeld(far))
  if (colored !== undefined) {
    const fill = fillIn(colored)
    const color = fill?.element.kind === "a:solidFill" ? colorIn(fill, null) : null
    if (color !== null) reads["text.color"] = read(color, colored.source)
  } else if (referenceColor !== null) reads["text.color"] = read(referenceColor, "style")
  const themed = (templateFont: TemplateFont, source: Source | undefined) => {
    const value = fonts.get(templateFont)
    return value === undefined ? undefined : { ...read(value, source), templateFont }
  }
  const typeface = (held: Held) => {
    const latin = child(held, "a:latin")
    const value = latin === undefined ? null : paintAttribute(latin.element, "typeface")
    if (value === null || value === "") return undefined
    const theme = fontReference.exec(value)
    return theme === null ? read(value, held.source) : themed(theme[1] === "j" ? "major" : "minor", held.source)
  }
  const referenceIndex = reference === undefined ? null : paintAttribute(reference.element, "idx")
  const font =
    near.map(typeface).find((each) => each !== undefined) ??
    (referenceIndex === "major" || referenceIndex === "minor" ? themed(referenceIndex, "style") : undefined) ??
    far.map(typeface).find((each) => each !== undefined)
  if (font !== undefined) reads["text.font"] = font
  const bold = [...near, ...far].find((held) => flag(held.element, "b") !== undefined)
  if (bold !== undefined && flag(bold.element, "b") === true) reads["text.bold"] = read(true, bold.source)
}

const root = (sheet: Sheet): Held => ({ element: sheet.elements[0]!, children: sheet.children })

export function sheetOf(parts: ReadonlyMap<string, Uint8Array>, part: string | null): Sheet | null {
  const bytes = part === null ? undefined : parts.get(part)
  return part === null || bytes === undefined ? null : sheetFrom(part, bytes)
}

export function stylesOf(theme: Sheet | null): Styles {
  if (theme === null) return { fills: [], lines: [], effects: [] }
  const format = child(child(root(theme), "a:themeElements"), "a:fmtScheme")
  const list = (kind: string) => {
    const found = child(format, kind)
    return found === undefined ? [] : inside(found).map((element) => ({ element, children: theme.children }))
  }
  return { fills: list("a:fillStyleLst"), lines: list("a:lnStyleLst"), effects: list("a:effectStyleLst") }
}

function fontsOf(theme: Sheet | null): Fonts {
  const fonts = new Map<TemplateFont, string>()
  if (theme === null) return fonts
  const scheme = child(child(root(theme), "a:themeElements"), "a:fontScheme")
  for (const [name, kind] of [
    ["major", "a:majorFont"],
    ["minor", "a:minorFont"],
  ] as const) {
    const latin = child(child(scheme, kind), "a:latin")
    const value = latin === undefined ? null : paintAttribute(latin.element, "typeface")
    if (value !== null && value !== "") fonts.set(name, value)
  }
  return fonts
}

function paletteOf(chain: Chain, fonts: Fonts): Palette {
  const slots: Partial<Record<TemplateColor, string>> = {}
  const scheme = chain.theme === null ? undefined : child(child(root(chain.theme), "a:themeElements"), "a:clrScheme")
  for (const element of scheme === undefined ? [] : inside(scheme)) {
    const slot = templateColors.find((name) => `a:${name}` === element.kind)
    const color = slot === undefined ? null : colorIn({ element, children: scheme!.children }, null)
    const hex = color === null ? null : "rgb" in color ? color.rgb : "system" in color ? color.last : null
    if (slot !== undefined && hex !== null) slots[slot] = hex
  }
  let mapping: readonly { readonly name: string; readonly value: string }[] = []
  for (const level of [chain.master, chain.layout, chain.sheet]) {
    if (level === null) continue
    const map =
      level === chain.master
        ? child(root(level), "p:clrMap")
        : child(child(root(level), "p:clrMapOvr"), "a:overrideClrMapping")
    if (map !== undefined) mapping = map.element.attributes
  }
  const map: Partial<Record<MappedSlot, TemplateColor>> = {}
  for (const { name, value } of mapping) {
    const slot = mappedSlots.find((each) => each === name)
    const target = templateColors.find((each) => each === value)
    if (slot !== undefined && target !== undefined) map[slot] = target
  }
  return fonts.size === 0 ? { slots, map } : { slots, map, fonts: Object.fromEntries(fonts) }
}

export function ownersOf(item: Drawn | DrawnShape, chain: ShapeChain): readonly Held[] {
  const owners: Held[] = [{ element: item.element, children: chain.sheet.children }]
  const wanted = item.placeholder
  if (wanted === null) return owners
  const above = chain.layout === null ? undefined : layoutMatch(chain.layout, wanted)
  if (above !== undefined && chain.layout !== null)
    owners.push({ element: above.element, children: chain.layout.children, source: "layout" })
  const base = chain.master === null ? undefined : masterMatch(chain.master, above?.placeholder ?? wanted)
  if (base !== undefined && chain.master !== null)
    owners.push({ element: base.element, children: chain.master.children, source: "master" })
  return owners
}

export function readTraits(parts: ReadonlyMap<string, Uint8Array>): DeckTraits {
  const sheets = new Map<string, Sheet | null>()
  const cached = (part: string | null) => {
    if (part === null) return null
    if (!sheets.has(part)) sheets.set(part, sheetOf(parts, part))
    return sheets.get(part) ?? null
  }
  const palettes: Palette[] = []
  const paletteKeys: string[] = []
  const slides = new Map<string, number>()
  const elements = new Map<ElementId, ElementRead>()
  for (const { slide, part } of readSlides(parts)) {
    const sheet = cached(part)
    if (sheet === null) continue
    const layout = cached(linkedPart(parts, part, "slideLayout"))
    const master = layout === null ? null : cached(linkedPart(parts, layout.part, "slideMaster"))
    const theme = master === null ? null : cached(linkedPart(parts, master.part, "theme"))
    const chain: Chain = { sheet, layout, master, theme }
    const fonts = fontsOf(theme)
    const palette = paletteOf(chain, fonts)
    const key = JSON.stringify(palette)
    if (!paletteKeys.includes(key)) {
      paletteKeys.push(key)
      palettes.push(palette)
    }
    slides.set(slide, paletteKeys.indexOf(key))
    const styles = stylesOf(theme)
    const stands = new Map(standRecords(sheet.elements, sheet.children).map((stand) => [stand.shape, stand]))
    for (const item of sheet.drawn) {
      const owners = ownersOf(item, chain)
      const reads: Partial<Record<DesignKey, Read<unknown>>> = {}
      const kept: DesignKey[] = []
      shapeReads(owners, styles, reads, kept)
      const placed = transformReads(owners, reads)
      cornersReads(owners, reads)
      bodyReads(owners, reads)
      textReads(owners, item.placeholder?.type ?? null, chain, fonts, reads)
      Object.assign(reads, pictureReads(parts, sheet, item))
      if (owners[0] !== undefined) {
        extraEffectReads(propertiesOf(owners[0]), stands.get(item.shape), reads)
        connectionReads(slide, owners[0], reads)
      }
      const type = item.placeholder?.type
      const role =
        type === undefined
          ? undefined
          : type === "obj" && item.kind !== "p:sp"
            ? "object"
            : (roleOf.get(type) ?? "object")
      const link = item.kind === "p:sp" ? shownLink(parts, { slide, part, shape: item.shape }) : null
      elements.set(elementId(`${slide}.${item.shape}`), {
        ...(link === null || link.kind === "none" ? {} : { link }),
        ...(role === undefined ? {} : { role }),
        reads: reads as TraitReads,
        kept,
        ...(placed === undefined ? {} : { placed }),
      })
    }
  }
  return { palettes, slides, elements }
}
