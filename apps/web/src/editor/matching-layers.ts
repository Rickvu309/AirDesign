import { readElementId, type ElementId } from "@airdesign/document"
import { paintReader, readSlides, slideLayouts, type PaintElement } from "@airdesign/pptx"

export type MatchLayer = Pick<PaintElement, "name" | "kind" | "group" | "placeholder" | "box" | "text"> & {
  readonly node: ElementId
  readonly renamed?: true
}

export type MatchSlide = { readonly layout: string | undefined; readonly layers: readonly MatchLayer[] }

type LayerKey = { readonly layer: MatchLayer; readonly key: string; readonly byStyle: boolean }

function hierarchy(layer: MatchLayer, layers: readonly MatchLayer[]): readonly (string | number)[] | null {
  if (layer.group === null) return []
  const parent = layers.find((each) => each.node.endsWith(`.${layer.group}`))
  if (parent?.name === undefined || parent.name === "") return null
  const path = hierarchy(parent, layers)
  if (path === null) return null
  return [...path, parent.name, layers.filter((each) => each.group === layer.group).indexOf(layer)]
}

function styleOf(text: NonNullable<MatchLayer["text"]>) {
  const { paragraphs, ...body } = text
  return {
    ...body,
    paragraphs: paragraphs.map(({ from: _from, runs, bullet, ...style }) => ({
      ...style,
      bullet,
      runs: [...new Set(runs.map(({ from: _at, text: _text, kind: _kind, ...run }) => JSON.stringify(run)))],
    })),
  }
}

function layerKeys(slide: MatchSlide): readonly LayerKey[] {
  return slide.layers.flatMap<LayerKey>((layer) => {
    const path = hierarchy(layer, slide.layers)
    if (path === null) return []
    const { kind, name, placeholder, text } = layer
    if (placeholder !== null) {
      if (slide.layout === undefined) return []
      const key = JSON.stringify([path, kind, "placeholder", slide.layout, placeholder.type, placeholder.index ?? 0])
      return [{ layer, key, byStyle: false }]
    }
    if (
      text !== null &&
      layer.renamed !== true &&
      (name === undefined || /^(?:TextBox|Text Box|Shape) \d+$/.test(name))
    ) {
      const key = JSON.stringify([path, kind, "style", styleOf(text)])
      return [{ layer, key, byStyle: true }]
    }
    if (!name) return []
    return [{ layer, key: JSON.stringify([path, kind, "name", name]), byStyle: false }]
  })
}

function nearest(source: LayerKey, candidates: readonly LayerKey[]): ElementId | undefined {
  if (candidates.length === 1) return candidates[0]?.layer.node
  if (!source.byStyle || source.layer.box === null) return undefined
  const origin = source.layer.box
  const ranked = candidates
    .flatMap(({ layer }) =>
      layer.box === null
        ? []
        : [{ node: layer.node, distance: (origin.x - layer.box.x) ** 2 + (origin.y - layer.box.y) ** 2 }],
    )
    .sort((left, right) => left.distance - right.distance)
  const [first, second] = ranked
  return first?.distance === second?.distance ? undefined : first?.node
}

export function matchingLayers(slides: readonly MatchSlide[], selected: readonly ElementId[]): readonly ElementId[] {
  const at = slides.findIndex(({ layers }) => layers.some(({ node }) => selected.includes(node)))
  const source = slides[at]
  if (source === undefined) return []
  const keys = layerKeys(source).filter(({ layer }) => selected.includes(layer.node))
  if (keys.length === 0) return []
  const matches = new Set<ElementId>()
  slides.forEach((slide, index) => {
    if (at === index) return
    const candidates = layerKeys(slide)
    for (const key of keys) {
      const match = nearest(
        key,
        candidates.filter((candidate) => candidate.key === key.key),
      )
      if (match !== undefined) matches.add(match)
    }
  })
  return [...matches]
}

export function matchingInDeck(
  parts: ReadonlyMap<string, Uint8Array>,
  visible: ReadonlySet<ElementId>,
  selected: readonly ElementId[],
  renamed: ReadonlySet<ElementId>,
): readonly ElementId[] {
  const reader = paintReader(parts)
  const layouts = slideLayouts(parts)
  return matchingLayers(
    readSlides(parts).map(({ slide, part }) => ({
      layout: layouts.get(slide),
      layers: reader.slide(part).elements.flatMap((layer) => {
        const node = layer.from === "slide" ? readElementId(`${slide}.${layer.shape}`) : undefined
        return node !== undefined && visible.has(node)
          ? [{ ...layer, node, ...(renamed.has(node) ? { renamed: true } : {}) }]
          : []
      }),
    })),
    selected,
  )
}
