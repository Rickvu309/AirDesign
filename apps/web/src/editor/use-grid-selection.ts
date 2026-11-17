import { useLayoutEffect } from "react"
import type { SlideStrip } from "./slide-sidebar"

export function useGridSelection(
  onSelection: SlideStrip["onSelection"],
  selected: ReadonlySet<number>,
  current: number,
) {
  const key = [...selected].join(",")
  useLayoutEffect(() => {
    onSelection?.(key === "" ? [current] : key.split(",").map(Number))
  }, [onSelection, key, current])
}
