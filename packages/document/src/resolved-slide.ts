import type { Box } from "./box.js"
import type { SlideSize } from "./deck-index.js"
import type { Kind } from "./kinds.js"

export type Fill = "none" | "unknown" | { readonly rgb: string }

export type Spacing = { readonly percent: number } | { readonly points: number }

export type ResolvedRun = {
  readonly text: string
  readonly font: string
  readonly size: number
  readonly bold: boolean
  readonly italic: boolean
  readonly color: { readonly rgb: string } | null
}

export type ResolvedBullet = { readonly text: string; readonly font: string; readonly size: number }

export type ResolvedParagraph = {
  readonly align: "left" | "center" | "right" | "justify" | "distributed"
  readonly level: number
  readonly marginLeft: number
  readonly indent: number
  readonly lineHeight: Spacing | null
  readonly spaceBefore: Spacing | null
  readonly spaceAfter: Spacing | null
  readonly bullet: ResolvedBullet | null
  readonly runs: readonly ResolvedRun[]
  readonly end: { readonly font: string; readonly size: number }
}

export type ResolvedText = {
  readonly paragraphs: readonly ResolvedParagraph[]
  readonly insets: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
  readonly anchor: "top" | "middle" | "bottom"
  readonly wrap: boolean
  readonly fit: "none" | "shrink" | "grow"
  readonly fontScale: number
  readonly lineReduction: number
  readonly vertical: boolean
  readonly edgeSpacing?: boolean
}

export type ResolvedElement = {
  readonly node: string
  readonly kind: Kind
  readonly from: "slide" | "layout"
  readonly box: Box | null
  readonly rotation: number
  readonly grouped: boolean
  readonly placeholder: string | null
  readonly fill: Fill
  readonly text: ResolvedText | null
  readonly cells: readonly (readonly string[])[] | null
}

export type ResolvedSlide = {
  readonly slide: string
  readonly size: SlideSize
  readonly background: Fill
  readonly elements: readonly ResolvedElement[]
}
