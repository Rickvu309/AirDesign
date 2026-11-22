import type { ListIndent, MappedSlot, TextFill, SchemeName } from "@airdesign/document"

export type CanvasFit =
  | { readonly kind: "shrink"; readonly scale: number; readonly reduction: number; readonly held?: true }
  | { readonly kind: "grow"; readonly held?: true }

export type CanvasSpacing = { readonly percent: number } | { readonly length: number }

export type CanvasTemplateColor = {
  readonly scheme: SchemeName
  readonly css: string
  readonly mapped?: readonly MappedSlot[]
}

export type CanvasBullet = {
  readonly font: string | null
  readonly color: string | null
  readonly size: number | null
} & ({ readonly char: string } | { readonly autoNumber: string; readonly number: number; readonly start?: number })

export type CanvasRunStyle = {
  readonly picture?: string
  readonly fill?: TextFill
  readonly font: string | null
  readonly size: number
  readonly points?: number
  readonly bold: boolean
  readonly italic: boolean
  readonly underline?: boolean
  readonly strike?: boolean
  readonly letterSpacing?: number
  readonly caps?: "all" | "small" | "none" | "lower" | "title"
  readonly baseline?: number
  readonly color: string | null
  readonly highlight?: string | null
}

export type CanvasRun = CanvasRunStyle & { readonly from: number; readonly text: string }

export type CanvasParagraph = {
  readonly from: number
  readonly level?: number
  readonly align: "left" | "center" | "right" | "justify"
  readonly marginLeft?: number
  readonly indent?: number
  readonly lineHeight?: CanvasSpacing | null
  readonly spaceBefore?: CanvasSpacing | null
  readonly spaceAfter?: CanvasSpacing | null
  readonly bullet?: CanvasBullet | null
  readonly ownBullet?: true
  readonly runs: readonly CanvasRun[]
  readonly endStyle: CanvasRunStyle
}

export type CanvasText = {
  readonly fonts?: Readonly<Record<string, string>>
  readonly templateIndents?: readonly (ListIndent | null)[]
  readonly templateBullets?: readonly (CanvasBullet | null)[]
  readonly colors?: readonly CanvasTemplateColor[]
  readonly paragraphs: readonly CanvasParagraph[]
  readonly anchor: "top" | "middle" | "bottom"
  readonly insets: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  }
  readonly wrap: boolean
  readonly flow?: "horz" | "vert" | "vert270"
  readonly columns?: number
  readonly columnGap?: number
  readonly fit?: CanvasFit
  readonly overflow?: boolean
  readonly edgeSpacing?: boolean
}
