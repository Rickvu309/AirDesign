import { markupDocument, type MarkupElement } from "./element-span.js"
import { partCopies } from "./owned-parts.js"
import { sameBytes } from "./package-bytes.js"
import { within } from "./part-markup.js"
import { markupChildren } from "./text-value-route.js"

export type TableBreak = {
  readonly part: string
  readonly shape: string
  readonly reason: "cells" | "height" | "width"
}

const slidePart = /^ppt\/slides\/[^/]+\.xml$/

type TableShape = { readonly cells: boolean; readonly gap: number | null; readonly spare: number | null }

function number(element: MarkupElement | undefined, name: string): number | null {
  const value = element?.attributes.find((item) => item.name === name)?.value ?? ""
  return /^\d+$/.test(value) ? Number(value) : null
}

function sizeGap(frame: number | null, sizes: readonly (number | null)[]): number | null {
  if (frame === null || sizes.some((size) => size === null)) return null
  return frame - sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0)
}

function fits(cells: readonly MarkupElement[], columns: number): boolean {
  let at = 0
  for (const cell of cells) {
    const span = number(cell, "gridSpan") ?? 1
    if (span < 1 || at + span > columns) return false
    at += 1
  }
  return at === columns
}

function tableShapes(
  parts: ReadonlyMap<string, Uint8Array>,
  names: readonly string[],
): ReadonlyMap<string, TableShape> {
  const shapes = new Map<string, TableShape>()
  for (const part of names) {
    const bytes = parts.get(part)
    if (bytes === undefined) continue
    const { elements } = markupDocument(bytes)
    const children = markupChildren(elements)
    const kids = (parent: MarkupElement | undefined, kind: string) =>
      parent === undefined ? [] : (children[parent.index] ?? []).filter((element) => element.kind === kind)
    for (const frame of elements.filter((element) => element.kind === "p:graphicFrame")) {
      const id = elements.find((element) => element.kind === "p:cNvPr" && within(elements, element, frame))?.id
      const table = elements.find((element) => element.kind === "a:tbl" && within(elements, element, frame))
      if (id === undefined || id === null || table === undefined) continue
      const widths = kids(kids(table, "a:tblGrid")[0], "a:gridCol")
      const columns = widths.length
      const rows = kids(table, "a:tr")
      const ext = elements.find(
        (element) =>
          element.kind === "a:ext" && elements[element.parent]?.kind === "p:xfrm" && within(elements, element, frame),
      )
      shapes.set(`${part}\u0000${id}`, {
        cells: rows.every((row) => fits(kids(row, "a:tc"), columns)),
        gap: sizeGap(
          number(ext, "cy"),
          rows.map((row) => number(row, "h")),
        ),
        spare: sizeGap(
          number(ext, "cx"),
          widths.map((width) => number(width, "w")),
        ),
      })
    }
  }
  return shapes
}

export function newTableBreaks(
  before: ReadonlyMap<string, Uint8Array>,
  after: ReadonlyMap<string, Uint8Array>,
  copies: ReadonlyMap<string, string> = partCopies(before, after),
): readonly TableBreak[] {
  const changed = [...after].flatMap(([part, bytes]) =>
    slidePart.test(part) && !sameBytes(before.get(part) ?? new Uint8Array(), bytes) ? [part] : [],
  )
  const sources = changed.map((part) => copies.get(part) ?? part)
  const old = tableShapes(before, sources)
  const breaks: TableBreak[] = []
  for (const [key, shape] of tableShapes(after, changed)) {
    const [part = "", id = ""] = key.split("\u0000")
    const was = old.get(`${copies.get(part) ?? part}\u0000${id}`)
    if (!shape.cells && was?.cells !== false) breaks.push({ part, shape: id, reason: "cells" })
    if (shape.gap !== (was === undefined ? 0 : was.gap)) breaks.push({ part, shape: id, reason: "height" })
    if (shape.spare !== (was === undefined ? 0 : was.spare)) breaks.push({ part, shape: id, reason: "width" })
  }
  return breaks
}
