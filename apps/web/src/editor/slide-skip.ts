import * as doom from "@airdesign/doom"
import { slideListCopy } from "@/copy/slide-list-copy"

export function skipWrites(
  view: doom.Doom,
  slides: readonly doom.NodeId[],
  indices: readonly number[],
  skipped: boolean,
): doom.Write[] {
  return indices.flatMap((at): doom.Write[] => {
    const node = slides[at]
    if (node === undefined) return []
    if ((doom.propOf(view.nodes.get(node), "skipped") === true) === skipped) return []
    return [{ node, prop: "skipped", value: skipped }]
  })
}

export function skipSaid(skipping: boolean, count: number, number: number): string {
  return skipping ? slideListCopy.skippedInPresent(count, number) : slideListCopy.shownInPresent(count, number)
}
