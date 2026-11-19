import { morphPairs, readShows, readSlides, type SlideTransition } from "@airdesign/pptx"

export type ShownSlide = {
  readonly hidden: boolean
  readonly transition: SlideTransition | null
  readonly advance: number | null
}

const showsByPart = new WeakMap<
  ReadonlyMap<string, Uint8Array>,
  ReadonlyMap<string, ReturnType<typeof readShows>[number]>
>()

export function showsIn(
  parts: ReadonlyMap<string, Uint8Array>,
  slides: readonly (string | undefined)[],
): readonly ShownSlide[] {
  const read = showsByPart.get(parts) ?? new Map(readShows(parts).map((show) => [show.slide, show]))
  showsByPart.set(parts, read)
  return slides.map((slide) => {
    const show = slide === undefined ? undefined : read.get(slide)
    return { hidden: show?.hidden ?? false, transition: show?.transition ?? null, advance: show?.advance ?? null }
  })
}

export function layerPairs(
  parts: ReadonlyMap<string, Uint8Array>,
  from: string | undefined,
  to: string | undefined,
): readonly (readonly [string, string])[] {
  const slides = readSlides(parts)
  const left = slides.find((each) => each.slide === from)
  const right = slides.find((each) => each.slide === to)
  const before = left === undefined ? undefined : parts.get(left.part)
  const after = right === undefined ? undefined : parts.get(right.part)
  if (before === undefined || after === undefined) return []
  return morphPairs(before, after).map(
    ([shape, match]) => [`${String(from)}.${shape}`, `${String(to)}.${match}`] as const,
  )
}
