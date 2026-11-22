import type { scene } from "@airdesign/document"
import type { SlideGeometry } from "./slide-geometry"

export type PanelContext = {
  readonly ids: readonly scene.NodeId[]
  readonly view: scene.Scene
  readonly geometry: SlideGeometry
  readonly theme: scene.Theme
  readonly push: (writes: readonly scene.Write[]) => void
}
