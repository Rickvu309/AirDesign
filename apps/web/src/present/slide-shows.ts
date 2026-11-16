import { readShows, type SlideTransition } from "@airdesign/pptx"

export type ShownSlide = { readonly hidden: boolean; readonly transition: SlideTransition | null }

export function showsIn(
  parts: ReadonlyMap<string, Uint8Array>,
  slides: readonly (string | undefined)[],
): readonly ShownSlide[] {
  const read = new Map(readShows(parts).map((show) => [show.slide, show]))
  return slides.map((slide) => {
    const show = slide === undefined ? undefined : read.get(slide)
    return { hidden: show?.hidden ?? false, transition: show?.transition ?? null }
  })
}
