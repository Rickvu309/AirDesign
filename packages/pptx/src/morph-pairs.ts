import { markupDocument, type MarkupElement } from "./element-span.js"

const layerTags = new Set(["p:sp", "p:pic", "p:grpSp", "p:graphicFrame", "p:cxnSp"])

function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

function namedLayers(bytes: Uint8Array): ReadonlyMap<string, string | null> {
  const { elements, wellFormed } = markupDocument(bytes)
  const named = new Map<string, string | null>()
  if (!wellFormed) return named
  const tree = elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined) return named
  for (const layer of elements) {
    if (layer.parent !== tree.index || !layerTags.has(layer.kind)) continue
    const nonVisual = elements.find(
      (element) => element.kind === "p:cNvPr" && element.start > layer.start && element.end < layer.end,
    )
    const id = nonVisual === undefined ? undefined : attr(nonVisual, "id")
    const name = nonVisual === undefined ? undefined : attr(nonVisual, "name")
    if (id === undefined || name === undefined || name === "") continue
    named.set(name, named.has(name) ? null : id)
  }
  return named
}

export function morphPairs(from: Uint8Array, to: Uint8Array): readonly (readonly [string, string])[] {
  const before = namedLayers(from)
  const after = namedLayers(to)
  return [...before].flatMap(([name, id]) => {
    const match = after.get(name)
    return id === null || match === null || match === undefined ? [] : [[id, match] as const]
  })
}
