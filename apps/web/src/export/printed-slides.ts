import type * as doom from "@airdesign/doom"

export function pagesToPrint(
  slides: readonly doom.NodeId[],
  chosen: readonly number[],
  skipped: readonly boolean[],
  keepSkipped: boolean,
): readonly doom.NodeId[] | null {
  const pages = chosen.flatMap((at) => {
    const id = slides[at]
    if (id === undefined) return []
    if (!keepSkipped && skipped[at] === true) return []
    return [id]
  })
  return pages.length === 0 ? null : pages
}
