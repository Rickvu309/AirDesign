import type * as doom from "@airdesign/doom"
import { useLayoutEffect, useState, type RefObject } from "react"
import type { GridCarry } from "@/editor/canvas-carry"
import { carryOver } from "@/editor/grid-carry"
import type { GridLayout } from "@/editor/grid-lines"
import { edgePan } from "@/editor/grid-marquee"
import type { SlideGeometry } from "@/editor/slide-geometry"
import type { useGridCamera } from "@/editor/use-grid-camera"

export type GridCarried = { readonly over: doom.NodeId | null }

export function useGridCarry({
  layout,
  live,
  geometries,
  camera,
  land,
}: {
  readonly layout: GridLayout
  readonly live: string | null
  readonly geometries: RefObject<ReadonlyMap<doom.NodeId, SlideGeometry>>
  readonly camera: Pick<ReturnType<typeof useGridCamera>, "handlers" | "panBy">
  readonly land: (slide: doom.NodeId, ids: readonly doom.NodeId[]) => void
}) {
  const [carried, setCarried] = useState<GridCarried | null>(null)
  useLayoutEffect(() => {
    if (live === null) setCarried(null)
  }, [live])
  const carry: GridCarry = {
    over: (at) => (live === null ? { kind: "none" } : carryOver(layout.cards, live, at, geometries.current)),
    onCarry: (over) => setCarried(over === undefined ? null : { over }),
    edge: (client) => {
      const host = camera.handlers.ref.current
      if (host === null) return false
      const speed = edgePan(client, host.getBoundingClientRect())
      if (speed.x === 0 && speed.y === 0) return false
      camera.panBy(speed)
      return true
    },
    landed: land,
  }
  return { carried, carry }
}
