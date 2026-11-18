import { useLayoutEffect } from "react"
import { gridDesigned, gridPick, gridRinged, type GridInteraction } from "./grid-interaction"
import { prunedPick, visiblePick } from "./grid-selection"
import type { SlideStrip } from "./slide-sidebar"

function useGridSelection(
  onSelection: SlideStrip["onSelection"],
  selected: ReadonlySet<number>,
  current: number | null,
) {
  const key = [...selected].join(",")
  useLayoutEffect(() => {
    onSelection?.(key === "" ? (current === null ? [] : [current]) : key.split(",").map(Number))
  }, [onSelection, key, current])
}

export function useShownSelection(
  state: GridInteraction,
  strip: SlideStrip,
  shown: (index: number) => boolean,
  onSlideSelection: ((count: number) => void) | undefined,
) {
  const { current, count, slideIds } = strip
  const picked = visiblePick(prunedPick(gridPick(state), count, slideIds), shown)
  const selected = new Set(gridRinged(state, current, count, slideIds).filter(shown))
  const designed = gridDesigned(state, current, count, slideIds, shown)
  useLayoutEffect(() => onSlideSelection?.(designed), [onSlideSelection, designed])
  useGridSelection(strip.onSelection, selected, shown(current) ? current : null)
  return { picked, selected }
}
