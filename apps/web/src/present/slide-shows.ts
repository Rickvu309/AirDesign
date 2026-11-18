import { readShows, type SlideTransition } from "@airdesign/pptx"

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
