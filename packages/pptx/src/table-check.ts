import { markupDocument, type MarkupElement } from "./element-span.js"
import { sameBytes, within } from "./part-markup.js"
import { markupChildren } from "./text-value-route.js"

export type TableBreak = { readonly part: string; readonly shape: string; readonly reason: "cells" | "height" }

const slidePart = /^ppt\/slides\/[^/]+\.xml$/

type TableShape = { readonly cells: boolean; readonly gap: number | null }

function number(element: MarkupElement | undefined, name: string): number | null {
  const value = element?.attributes.find((item) => item.name === name)?.value ?? ""
  return /^\d+$/.test(value) ? Number(value) : null
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
      const columns = kids(kids(table, "a:tblGrid")[0], "a:gridCol").length
      const rows = kids(table, "a:tr")
      const ext = elements.find(
        (element) =>
          element.kind === "a:ext" && elements[element.parent]?.kind === "p:xfrm" && within(elements, element, frame),
      )
      const heights = rows.map((row) => number(row, "h"))
      const frameHeight = number(ext, "cy")
      const gap =
        frameHeight === null || heights.some((height) => height === null)
          ? null
          : frameHeight - heights.reduce<number>((sum, height) => sum + (height ?? 0), 0)
      shapes.set(`${part}\u0000${id}`, { cells: rows.every((row) => kids(row, "a:tc").length === columns), gap })
    }
  }
  return shapes
}

export function newTableBreaks(
  before: ReadonlyMap<string, Uint8Array>,
  after: ReadonlyMap<string, Uint8Array>,
): readonly TableBreak[] {
  const changed = [...after].flatMap(([part, bytes]) =>
    slidePart.test(part) && !sameBytes(before.get(part) ?? new Uint8Array(), bytes) ? [part] : [],
  )
  const old = tableShapes(before, changed)
  const breaks: TableBreak[] = []
  for (const [key, shape] of tableShapes(after, changed)) {
    const [part = "", id = ""] = key.split("\u0000")
    const was = old.get(key)
    if (!shape.cells && was?.cells !== false) breaks.push({ part, shape: id, reason: "cells" })
    if (shape.gap !== (was === undefined ? 0 : was.gap)) breaks.push({ part, shape: id, reason: "height" })
  }
  return breaks
}
