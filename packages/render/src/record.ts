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

export type CanvasOutline = "box" | "round" | "ellipse" | "line"

export type CanvasLine = {
  readonly color: string
  readonly width: number
  readonly dash: readonly number[] | null
}

export type CanvasSpacing = { readonly percent: number } | { readonly length: number }

export type CanvasBullet = {
  readonly font: string | null
  readonly color: string | null
  readonly size: number | null
} & ({ readonly char: string } | { readonly autoNumber: string; readonly number: number })

export type CanvasRunStyle = {
  readonly font: string | null
  readonly size: number
  readonly bold: boolean
  readonly italic: boolean
  readonly underline?: boolean
  readonly strike?: boolean
  readonly baseline?: number
  readonly color: string | null
  readonly highlight?: string | null
}

export type CanvasRun = CanvasRunStyle & { readonly from: number; readonly text: string }

export type CanvasParagraph = {
  readonly from: number
  readonly align: "left" | "center" | "right" | "justify"
  readonly marginLeft?: number
  readonly indent?: number
  readonly lineSpacing?: CanvasSpacing | null
  readonly spaceBefore?: CanvasSpacing | null
  readonly spaceAfter?: CanvasSpacing | null
  readonly bullet?: CanvasBullet | null
  readonly runs: readonly CanvasRun[]
  readonly endStyle: CanvasRunStyle
}

export type CanvasText = {
  readonly paragraphs: readonly CanvasParagraph[]
  readonly anchor: "top" | "middle" | "bottom"
  readonly insets: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  }
  readonly wrap: boolean
}

export type CanvasElement = {
  readonly key: string
  readonly id: ElementId | null
  readonly kind: Kind
  readonly box: PaintBox | null
  readonly editable: boolean
  readonly placeholder: boolean
  readonly filled: boolean
  readonly fill: string | null
  readonly line: CanvasLine | null
  readonly outline: CanvasOutline
  readonly text: CanvasText | null
}

export type CanvasSlide = {
  readonly width: number
  readonly height: number
  readonly background: string | null
  readonly elements: readonly CanvasElement[]
}

export type Thumb =
  | { readonly id: SlideId; readonly kind: "image"; readonly src: string }
  | { readonly id: SlideId; readonly kind: "deep"; readonly width: number; readonly height: number }
