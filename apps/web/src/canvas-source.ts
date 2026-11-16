import type { ElementId, Kind } from "@airdesign/document"
import type { CanvasSlide } from "@airdesign/render"

export type CanvasShape = {
  readonly id: ElementId
  readonly kind: Kind
  readonly editable: boolean
  readonly movable: boolean
  readonly refit?: true
}

export type CanvasSource = { readonly part: string; readonly shapes: ReadonlyMap<string, CanvasShape> }

export type SlideCanvases = (index: number) => CanvasSlide | null
