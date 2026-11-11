import type { Kind } from "@airdesign/document"
import type { ElementId, SlideId } from "@airdesign/document"

export type ElementRecord = {
  readonly id: ElementId
  readonly kind: Kind
  readonly text: string
  readonly picture: string | null
}

export type SlideRecord = {
  readonly id: SlideId
  readonly elements: readonly ElementId[]
}

export type PaintBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
  readonly flipH: boolean
  readonly flipV: boolean
}

export type CanvasElement = {
  readonly key: string
  readonly id: ElementId | null
  readonly kind: Kind
  readonly box: PaintBox | null
  readonly editable: boolean
}

export type CanvasSlide = {
  readonly width: number
  readonly height: number
  readonly elements: readonly CanvasElement[]
}

export type Thumb =
  | { readonly id: SlideId; readonly kind: "image"; readonly src: string }
  | { readonly id: SlideId; readonly kind: "deep"; readonly width: number; readonly height: number }
