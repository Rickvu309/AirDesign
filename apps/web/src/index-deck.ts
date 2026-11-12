import { floorFor, nextSlideId, orderKeyBetween, readSlideId } from "@airdesign/document"
import { connect } from "@airdesign/live"
import { indexPackage, orderedParts } from "@airdesign/pptx"
import { server } from "@/commit-edit"

export function indexedParts(parts: ReadonlyMap<string, Uint8Array>) {
  const indexed = indexPackage(parts)
  const file = indexed.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const id = nextSlideId(file)
  const slides = indexed.slides.map((row) => {
    const source = readSlideId(row.id)
    if (source === undefined) return row
    const edit = { slide: "add", id, after: source, layout: source, key: orderKeyBetween(null, null) } as const
    try {
      const layout = indexPackage(orderedParts(parts, { file, order: [edit] })).elements.filter((row) =>
        row.node.startsWith(`${id}.`),
      )
      return { ...row, layout: floorFor(layout, source) }
    } catch {
      return row
    }
  })
  return { ...indexed, slides }
}

export async function backfillIndex(deck: string, parts: ReadonlyMap<string, Uint8Array>): Promise<void> {
  const queued = await connect(server).index(deck, indexedParts(parts))
  if (!queued.ok) throw new Error(queued.refusal)
}
