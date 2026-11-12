import {
  bytesOf,
  floorFor,
  limits,
  readIndexPage,
  nextSlideId,
  orderKeyBetween,
  readSlideId,
  type IndexElement,
  type OrderKey,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { connect } from "@airdesign/live"
import { indexPackage, orderedParts, slideLayouts } from "@airdesign/pptx"
import { server } from "@/commit-edit"

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
    const elements = indexPackage(orderedParts(parts, { file, order })).elements
    for (const { from, id } of born) {
      const made = elements.filter((row) => row.node.startsWith(`${id}.`))
      for (const source of from) floors.set(source, floorFor(made, source))
    }
  } catch {
    floors.clear()
  }
  return floors
}

function layoutsFit(index: ReturnType<typeof indexPackage>): boolean {
  if (bytesOf(JSON.stringify(index.slides)) >= limits.row / 2) return false
  const page = readIndexPage({
    once: "layouts",
    offset: 0,
    total: index.elements.length,
    slides: index.slides,
    elements: index.elements.slice(0, 1),
  })
  return page !== null
}

export function indexedParts(parts: ReadonlyMap<string, Uint8Array>) {
  const indexed = indexPackage(parts)
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
  if (await connect(server).layered(deck)) return
  const queued = await connect(server).index(deck, indexedParts(parts))
  if (!queued.ok) throw new Error(queued.refusal)
}
