import { markupDocument, type MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintFill } from "./paint-color.js"
import { paintChild, paintFill } from "./paint-fill.js"
import type { PaintLine } from "./paint-shape.js"
import type { PaintRunStyle, PaintTextHolder, PaintTextScope } from "./paint-text.js"
import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"

export type TableStyle = {
  readonly element: MarkupElement
  readonly children: MarkupChildren
}

export const tableFlag = (element: MarkupElement | undefined, name: string): boolean =>
  element !== undefined && ["1", "true"].includes(paintAttribute(element, name) ?? "")

export const tableNumber = (element: MarkupElement | undefined, name: string, standard: number): number => {
  const value = element === undefined ? null : paintAttribute(element, name)
  const number = value !== null && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(number) ? number : standard
}

export const tableStyles = (parts: ReadonlyMap<string, Uint8Array>) => {
  let known: ReadonlyMap<string, TableStyle> | undefined
  return (properties: MarkupElement | undefined, children: MarkupChildren, bytes: Uint8Array): TableStyle | null => {
    const id = paintChild(children, properties, "a:tableStyleId")
    const inline = paintChild(children, properties, "a:tableStyle")
    if (inline !== undefined) return { element: inline, children }
    if (id === undefined) return null
    if (known === undefined) {
      const source = parts.get("ppt/tableStyles.xml")
      const elements = source === undefined ? [] : markupDocument(source).elements
      const inside = markupChildren(elements)
      known = new Map(
        elements
          .filter((each) => each.kind === "a:tblStyle")
          .map((element) => [(paintAttribute(element, "styleId") ?? "").toUpperCase(), { element, children: inside }]),
      )
    }
    return known.get(holderText(bytes, id).trim().toUpperCase()) ?? null
  }
}

export const tableLayers = (
  style: TableStyle | null,
  properties: MarkupElement | undefined,
  row: number,
): readonly PaintTextHolder[] => {
  if (style === null) return []
  const names = [
    ...(row === 0 && tableFlag(properties, "firstRow") ? ["a:firstRow"] : []),
    ...(tableFlag(properties, "bandRow") && (row > 0 || !tableFlag(properties, "firstRow"))
      ? [`a:band${(row - (tableFlag(properties, "firstRow") ? 1 : 0)) % 2 === 0 ? 1 : 2}H`]
      : []),
    "a:wholeTbl",
  ]
  return names.flatMap((kind) => {
    const element = paintChild(style.children, style.element, kind)
    return element === undefined ? [] : [{ element, children: style.children }]
  })
}

export const tableFill = (layers: readonly PaintTextHolder[], scope: PaintTextScope): PaintFill | null => {
  for (const layer of layers) {
    const cell = paintChild(layer.children, layer.element, "a:tcStyle")
    const holder = paintChild(layer.children, cell, "a:fill")
    if (holder !== undefined) return paintFill(holder, layer.children, scope.palette, () => null)
  }
  return null
}

export const tableTextStyle = (
  layers: readonly PaintTextHolder[],
  scope: PaintTextScope,
): Partial<Pick<PaintRunStyle, "font" | "color" | "bold" | "italic">> => {
  const result: Partial<Pick<PaintRunStyle, "font" | "color" | "bold" | "italic">> = {}
  for (const layer of layers) {
    const text = paintChild(layer.children, layer.element, "a:tcTxStyle")
    if (text === undefined) continue
    const color = layer.children[text.index]?.find((each) =>
      ["a:srgbClr", "a:schemeClr", "a:scrgbClr", "a:prstClr", "a:sysClr", "a:hslClr"].includes(each.kind),
    )
    if (result.color === undefined && color !== undefined)
      result.color = paintColor(color, layer.children, scope.palette)
    for (const [name, key] of [
      ["b", "bold"],
      ["i", "italic"],
    ] as const) {
      const value = paintAttribute(text, name)
      if (result[key] === undefined && value !== null && value !== "def") result[key] = value === "on"
    }
    const reference = paintChild(layer.children, text, "a:fontRef")
    const index = reference === undefined ? null : paintAttribute(reference, "idx")
    const slot = index === "major" ? "+mj-lt" : index === "minor" ? "+mn-lt" : ""
    const font = paintChild(layer.children, paintChild(layer.children, text, "a:font"), "a:latin")
    const family = font === undefined ? undefined : (paintAttribute(font, "typeface") ?? undefined)
    const resolved = family ?? scope.fonts.get(slot)
    if (result.font === undefined && resolved !== undefined) result.font = resolved
  }
  return result
}

export const tableLine = (
  line: MarkupElement | undefined,
  children: MarkupChildren,
  scope: PaintTextScope,
): PaintLine | null => {
  if (line === undefined) return null
  const dash = paintChild(children, line, "a:prstDash")
  return {
    fill: paintFill(line, children, scope.palette, () => null) ?? { type: "none" },
    width: tableNumber(line, "w", 12700),
    dash: dash === undefined ? null : paintAttribute(dash, "val"),
    head: null,
    tail: null,
  }
}

export const tableBorder = (
  layers: readonly PaintTextHolder[],
  side: "left" | "right" | "top" | "bottom",
  inside: boolean,
  scope: PaintTextScope,
): PaintLine | null => {
  const direction = side === "top" || side === "bottom" ? "a:insideH" : "a:insideV"
  for (const layer of layers) {
    const cell = paintChild(layer.children, layer.element, "a:tcStyle")
    const borders = paintChild(layer.children, cell, "a:tcBdr")
    const edge = paintChild(layer.children, borders, `a:${side}`)
    const inner = inside ? paintChild(layer.children, borders, direction) : undefined
    const holder = layer.element.kind === "a:wholeTbl" && inside ? (inner ?? edge) : (edge ?? inner)
    const line = paintChild(layer.children, holder, "a:ln")
    if (line !== undefined) return tableLine(line, layer.children, scope)
  }
  return null
}
