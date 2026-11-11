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

export type Thumb =
  | { readonly id: SlideId; readonly kind: "image"; readonly src: string }
  | { readonly id: SlideId; readonly kind: "deep"; readonly width: number; readonly height: number }
