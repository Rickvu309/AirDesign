import { readTextStyles, type TextStyle, type TextStyleFields } from "@airdesign/document"
import { colorIn } from "./color-read.js"
import { child, flag, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { presentationPart } from "./package-address.js"
import { paintAttribute } from "./paint-color.js"
import { masterMatch, type Sheet } from "./paint-sheet.js"
import { sheetOf, textStyleKind } from "./trait-read.js"

const root = (sheet: Sheet): Held => ({ element: sheet.elements[0]!, children: sheet.children })
const present = (held: readonly (Held | undefined)[]): readonly Held[] => held.filter((each) => each !== undefined)
const attribute = (held: Held | undefined, name: string) =>
  held === undefined ? undefined : (paintAttribute(held.element, name) ?? undefined)
const number = (held: Held | undefined, name: string) => (held === undefined ? undefined : whole(held.element, name))
const boolean = (held: Held | undefined, name: string) => (held === undefined ? undefined : flag(held.element, name))

function levels(list: Held | undefined, level: number): readonly Held[] {
  return present([child(list, `a:lvl${String(level + 1)}pPr`), child(list, "a:defPPr")])
}

function fieldsOf(paragraphs: readonly Held[], local: readonly Held[]): TextStyleFields | null {
  const runs = [...local, ...paragraphs.flatMap((held) => child(held, "a:defRPr") ?? [])]
  const first = <T>(layers: readonly Held[], read: (held: Held) => T | undefined): T | undefined =>
    layers.map(read).find((value) => value !== undefined)
  const spacing = (tag: string, percent: boolean): number | null => {
    const held = paragraphs.map((each) => child(each, tag)).find((each) => each !== undefined)
    if (held === undefined) return percent ? 100000 : 0
    const amount = number(child(held, percent ? "a:spcPct" : "a:spcPts"), "val")
    return amount ?? (number(child(held, "a:spcPct"), "val") === 0 ? 0 : null)
  }
  const lineSpacing = spacing("a:lnSpc", true)
  const spaceBefore = spacing("a:spcBef", false)
  const spaceAfter = spacing("a:spcAft", false)
  const align = first(paragraphs, (held) => attribute(held, "algn")) ?? "l"
  if (lineSpacing === null || spaceBefore === null || spaceAfter === null || !["l", "ctr", "r"].includes(align))
    return null
  const fill = first(runs, (held) => child(held, "a:solidFill"))
  const color = fill === undefined ? { scheme: "tx1" as const } : colorIn(fill, null)
  if (color === null) return null
  if (runs.some((held) => inside(held).some((each) => ["a:gradFill", "a:pattFill", "a:noFill"].includes(each.kind))))
    return null
  return {
    font: first(runs, (held) => attribute(child(held, "a:latin"), "typeface")) ?? "+mn-lt",
    size: first(runs, (held) => number(held, "sz")) ?? 1800,
    bold: first(runs, (held) => boolean(held, "b")) ?? false,
    italic: first(runs, (held) => boolean(held, "i")) ?? false,
    color,
    align: align === "ctr" ? "center" : align === "r" ? "right" : "left",
    letterSpacing: first(runs, (held) => number(held, "spc")) ?? 0,
    lineSpacing,
    spaceBefore,
    spaceAfter,
  }
}

export function slideTextStyles(parts: ReadonlyMap<string, Uint8Array>, slidePart: string): readonly TextStyle[] {
  const layout = sheetOf(parts, linkedPart(parts, slidePart, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  if (master === null) return []
  const defaults = sheetOf(parts, presentationPart)
  const fallback = defaults === null ? undefined : child(root(defaults), "p:defaultTextStyle")
  const styles = child(root(master), "p:txStyles")
  const candidates: TextStyle[] = []
  const add = (id: string, name: string, layers: readonly Held[], local: readonly Held[] = []) => {
    const fields = fieldsOf(layers, local)
    if (
      fields !== null &&
      readTextStyles([{ id, name, fields }]) !== null &&
      !candidates.some((each) => JSON.stringify(each.fields) === JSON.stringify(fields))
    )
      candidates.push({ id, name, fields })
  }
  for (const [tag, name] of [
    ["p:titleStyle", "Title"],
    ["p:bodyStyle", "Body"],
    ["p:otherStyle", "Other text"],
  ] as const) {
    const list = child(styles, tag)
    if (list === undefined) continue
    for (let level = 0; level < (tag === "p:titleStyle" ? 1 : 9); level += 1) {
      if (child(list, `a:lvl${String(level + 1)}pPr`) === undefined) continue
      add(
        `${master.part}/${tag.slice(2)}/${String(level)}`,
        tag === "p:bodyStyle" ? `${name} ${String(level + 1)}` : level === 0 ? name : `${name} ${String(level + 1)}`,
        [...levels(list, level), ...levels(fallback, level)],
      )
    }
  }
  if (layout !== null) {
    for (const item of layout.drawn) {
      if (
        item.placeholder === null ||
        !["title", "ctrTitle", "subTitle", "body", "obj"].includes(item.placeholder.type)
      )
        continue
      const held = { element: item.element, children: layout.children }
      const body = child(held, "p:txBody")
      if (body === undefined) continue
      const inherited = masterMatch(master, item.placeholder)
      const base =
        inherited === undefined
          ? undefined
          : child({ element: inherited.element, children: master.children }, "p:txBody")
      const list = child(styles, textStyleKind(item.placeholder.type))
      const title = item.placeholder.type === "title" || item.placeholder.type === "ctrTitle"
      const name = title ? "Title" : item.placeholder.type === "subTitle" ? "Subtitle" : "Body"
      const paragraphs = inside(body).filter((each) => each.kind === "a:p")
      for (const paragraph of paragraphs) {
        const properties = child({ ...body, element: paragraph }, "a:pPr")
        const level = number(properties, "lvl") ?? 0
        const layers = [
          ...present([properties]),
          ...levels(child(body, "a:lstStyle"), level),
          ...levels(child(base, "a:lstStyle"), level),
          ...levels(list, level),
          ...levels(fallback, level),
        ]
        const localName = name === "Body" ? `${name} ${String(level + 1)}` : name
        const duplicate = candidates.some((style) => style.name === localName)
        const layoutName = attribute(child(root(layout), "p:cSld"), "name")
        const holder = { ...body, element: paragraph }
        const run = inside(holder).find((each) => each.kind === "a:r")
        const local = present([
          child(run === undefined ? undefined : { ...holder, element: run }, "a:rPr"),
          child(holder, "a:endParaRPr"),
        ])
        add(
          `${layout.part}/${item.shape}/${String(level)}`,
          duplicate ? `${localName} · ${layoutName ?? "Layout"}` : localName,
          layers,
          local,
        )
      }
    }
  }
  const order = (name: string) =>
    name.startsWith("Title") ? 0 : name.startsWith("Subtitle") ? 1 : name.startsWith("Body") ? 2 : 3
  return readTextStyles(candidates.sort((a, b) => order(a.name) - order(b.name))) ?? []
}
