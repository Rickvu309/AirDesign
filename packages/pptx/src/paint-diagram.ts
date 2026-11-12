import { markupDocument, type MarkupElement } from "./element-span.js"
import { paintChild } from "./paint-fill.js"
import type { PaintBox } from "./paint-reader.js"
import { attr, boxOf, drawingFrom, finalPlacement, ownPlacement, type Drawn, type Sheet } from "./paint-sheet.js"
import type { MarkupChildren } from "./text-value-route.js"

export type DiagramShape = {
  readonly drawn: Drawn
  readonly box: PaintBox | null
  readonly textBox: PaintBox | null
}

export type Diagram = {
  readonly sheet: Sheet
  readonly shapes: readonly DiagramShape[]
}

type Axis = { readonly from: number; readonly to: number; readonly ratio: number; readonly scale: number }

const drawingPrefix = "dsp:"

const number = (element: MarkupElement | undefined, name: string): number | null => {
  const value = element === undefined ? null : attr(element, name)
  if (value === null || !/^[+-]?\d+$/.test(value)) return null
  const read = Number(value)
  return Number.isSafeInteger(read) ? read : null
}

const asSlideShapes = (elements: readonly MarkupElement[]): readonly MarkupElement[] =>
  elements.map((element) =>
    element.kind.startsWith(drawingPrefix)
      ? { ...element, kind: `p:${element.kind.slice(drawingPrefix.length)}` }
      : element,
  )

const drawingPart = (
  frame: Drawn,
  children: MarkupChildren,
  parts: ReadonlyMap<string, Uint8Array>,
  target: (id: string) => string | undefined,
): string | undefined => {
  const graphic = paintChild(children, frame.element, "a:graphic")
  const ids = paintChild(children, paintChild(children, graphic, "a:graphicData"), "dgm:relIds")
  const model = ids === undefined ? null : attr(ids, "r:dm")
  const dataPart = model === null ? undefined : target(model)
  const data = dataPart === undefined ? undefined : parts.get(dataPart)
  if (data === undefined) return undefined
  const pointer = markupDocument(data).elements.find((element) => element.kind === "dsp:dataModelExt")
  const id = pointer === undefined ? null : attr(pointer, "relId")
  return id === null ? undefined : target(id)
}

const axes = (sheet: Sheet, own: { width: number; height: number }, box: PaintBox): readonly [Axis, Axis] => {
  const tree = paintChild(sheet.children, sheet.elements[0], "p:spTree")
  const xfrm = paintChild(sheet.children, paintChild(sheet.children, tree, "p:grpSpPr"), "a:xfrm")
  const at = (kind: string) => paintChild(sheet.children, xfrm, kind)
  const axis = (offset: string, size: string, ownSize: number, frameSize: number): Axis => {
    const scale = ownSize === 0 ? 1 : frameSize / ownSize
    const outer = number(at("a:ext"), size)
    const inner = number(at("a:chExt"), size)
    if (outer === null || inner === null || outer < 0 || inner <= 0) return { from: 0, to: 0, ratio: 1, scale }
    return {
      from: number(at("a:chOff"), offset) ?? 0,
      to: number(at("a:off"), offset) ?? 0,
      ratio: outer / inner,
      scale,
    }
  }
  return [axis("x", "cx", own.width, box.width), axis("y", "cy", own.height, box.height)]
}

const place = (value: number, axis: Axis): number => (axis.to + (value - axis.from) * axis.ratio) * axis.scale

const inFrame = (box: PaintBox | null, [across, down]: readonly [Axis, Axis]): PaintBox | null => {
  if (box === null) return null
  const width = box.width * across.ratio * across.scale
  const height = box.height * down.ratio * down.scale
  return {
    ...box,
    x: place(box.x + box.width / 2, across) - width / 2,
    y: place(box.y + box.height / 2, down) - height / 2,
    width,
    height,
  }
}

const textBoxOf = (sheet: Sheet, drawn: Drawn): PaintBox | null => {
  const own = ownPlacement(sheet.children, paintChild(sheet.children, drawn.element, "p:txXfrm"))
  if (typeof own === "string" || typeof drawn.own === "string") return null
  return boxOf(finalPlacement({ ...drawn, own: { ...own, turn: own.turn + drawn.own.turn } }))
}

export const paintDiagram = (
  frame: Drawn,
  children: MarkupChildren,
  box: PaintBox,
  parts: ReadonlyMap<string, Uint8Array>,
  target: (id: string) => string | undefined,
): Diagram | null => {
  if (frame.kind !== "p:graphicFrame" || typeof frame.own === "string") return null
  const part = drawingPart(frame, children, parts, target)
  const bytes = part === undefined ? undefined : parts.get(part)
  if (part === undefined || bytes === undefined) return null
  const markup = markupDocument(bytes)
  if (!markup.wellFormed) return null
  const sheet = drawingFrom(part, bytes, asSlideShapes(markup.elements))
  const frameAxes = axes(sheet, frame.own, box)
  const shapes = sheet.drawn
    .filter((drawn) => !drawn.hidden && drawn.kind !== "p:grpSp")
    .map((drawn) => ({
      drawn,
      box: inFrame(boxOf(finalPlacement(drawn)), frameAxes),
      textBox: inFrame(textBoxOf(sheet, drawn), frameAxes),
    }))
  return { sheet, shapes }
}
