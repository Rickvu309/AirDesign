import * as doom from "@airdesign/doom"
import { useDoomSlide } from "@airdesign/render"
import { useLayoutEffect, useMemo } from "react"
import { geometryOf, type SlideGeometry } from "@/editing/slide-geometry"

export function GridTargets({
  view,
  slide,
  onGeometry,
}: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly onGeometry: (slide: doom.NodeId, geometry: SlideGeometry | null) => void
}) {
  const painted = useDoomSlide(view, slide, 0)
  const geometry = useMemo(() => (painted.nodes === null ? null : geometryOf(painted.nodes)), [painted.nodes])
  useLayoutEffect(() => {
    onGeometry(slide, geometry)
    return () => onGeometry(slide, null)
  }, [slide, geometry, onGeometry])
  return null
}
