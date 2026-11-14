import {
  bytesOf,
  floorFor,
  limits,
  readIndexPage,
  nextSlideId,
  orderKeyBetween,
  readSlideId,
  type DeckIndex,
  type IndexElement,
  type OrderKey,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { designOf } from "@airdesign/catalog"
import { connect } from "@airdesign/live"
import { indexPackage, orderedParts, readTraits, slideLayouts, type DeckTraits } from "@airdesign/pptx"
import { server } from "@/commit-edit"

function traitsOf(parts: ReadonlyMap<string, Uint8Array>): DeckTraits | null {
  try {
    return readTraits(parts)
  } catch {
    return null
  }
}

export function designedParts(
  parts: ReadonlyMap<string, Uint8Array>,
): Pick<DeckIndex, "palettes" | "slides" | "elements"> {
  const opening = indexPackage(parts)
  const traits = traitsOf(parts)
  if (traits === null) return opening
  const elements = opening.elements.map((element) => {
    const read = traits.elements.get(element.node)
    return read === undefined ? element : { ...element, ...designOf(read) }
  })
  const slides = opening.slides.map((slide) => {
    const palette = traits.slides.get(slide.id) ?? 0
    return palette === 0 ? slide : { ...slide, palette }
  })
  return { ...(traits.palettes.length === 0 ? {} : { palettes: traits.palettes }), slides, elements }
}

function layoutFloors(parts: ReadonlyMap<string, Uint8Array>, file: readonly SlideId[]) {
  const layouts = slideLayouts(parts)
  const sources = new Map<string, SlideId[]>()
  for (const source of file) {
    const layout = layouts.get(source)
    if (layout !== undefined) sources.set(layout, [...(sources.get(layout) ?? []), source])
  }
  const born: { readonly from: readonly SlideId[]; readonly id: SlideId }[] = []
  const order: SlideCommand[] = []
  let key: OrderKey | null = null
  for (const from of sources.values()) {
    const source = from[0]
    if (source === undefined) continue
    const id = nextSlideId([...file, ...born.map((row) => row.id)])
    key = orderKeyBetween(key, null)
    born.push({ from, id })
    order.push({ slide: "add", id, after: source, layout: source, key })
  }
  const floors = new Map<SlideId, readonly IndexElement[]>()
  try {
    const layered = orderedParts(parts, { file, order })
    const elements = indexPackage(layered).elements
    const roles = traitsOf(layered)?.elements
    for (const { from, id } of born) {
      const made = elements.flatMap((row) => {
        if (!row.node.startsWith(`${id}.`)) return []
        const role = roles?.get(row.node)?.role
        return [role === undefined ? row : { ...row, role }]
      })
      for (const source of from) floors.set(source, floorFor(made, source))
    }
  } catch {
    floors.clear()
  }
  return floors
}

function layoutsFit(index: ReturnType<typeof designedParts>): boolean {
  if (bytesOf(JSON.stringify(index.slides)) >= limits.row / 2) return false
  const page = readIndexPage({
    ...(index.palettes === undefined ? {} : { palettes: index.palettes }),
    once: "layouts",
    offset: 0,
    total: index.elements.length,
    slides: index.slides,
    elements: index.elements.slice(0, 1),
  })
  return page !== null
}

export function indexedParts(parts: ReadonlyMap<string, Uint8Array>) {
  const indexed = designedParts(parts)
  const file = indexed.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const floors = layoutFloors(parts, file)
  const slides = indexed.slides.map((row) => {
    const source = readSlideId(row.id)
    const layout = source === undefined ? undefined : floors.get(source)
    return layout === undefined ? row : { ...row, layout }
  })
  const layered = { ...indexed, slides }
  return layoutsFit(layered) ? layered : indexed
}

export async function backfillIndex(deck: string, parts: ReadonlyMap<string, Uint8Array>): Promise<void> {
  const queued = await connect(server).index(deck, indexedParts(parts))
  if (!queued.ok) throw new Error(queued.refusal)
}
