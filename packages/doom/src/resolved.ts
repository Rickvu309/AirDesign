import type { Arrow, Geometry } from "./geometry.js"
import type { ImagePaint, Hex, Px, StrokeStyle } from "./paint.js"
import type { PathBounds } from "./path-scale.js"
import type { Props } from "./props.js"

export type Box = Props["box"]
export type Point = { readonly x: Px; readonly y: Px }

export type ResolvedRun = {
  readonly text: string
  readonly size: Px
  readonly font: string
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly color: Hex
  readonly tracking: Px
  readonly link?: string
}

export type ResolvedLine = {
  readonly start: number
  readonly end: number
  readonly x: Px
  readonly y: Px
  readonly w: Px
  readonly h: Px
  readonly ink: Px
  readonly align: "left" | "center" | "right" | "justify"
  readonly runs: readonly ResolvedRun[]
  readonly label?: { readonly x: Px; readonly run: ResolvedRun }
}

export type ResolvedText = {
  readonly lines: readonly ResolvedLine[]
  readonly overflow?: "clip"
  readonly sourceLines?: readonly ResolvedLine[]
}

export type ResolvedPaint =
  | { readonly kind: "solid"; readonly color: Hex; readonly opacity: number }
  | {
      readonly kind: "gradient"
      readonly shape: "linear" | "radial"
      readonly angle: number
      readonly stops: readonly { readonly at: number; readonly color: Hex }[]
      readonly opacity: number
    }
  | (ImagePaint & { readonly opacity: number })

export type ResolvedEffect =
  | {
      readonly kind: "dropShadow" | "innerShadow"
      readonly color: Hex
      readonly opacity: number
      readonly x: Px
      readonly y: Px
      readonly blur: Px
      readonly spread: Px
    }
  | { readonly kind: "layerBlur" | "backgroundBlur"; readonly radius: Px }

export type ResolvedGeometry =
  | { readonly kind: "rect" }
  | { readonly kind: "ellipse" }
  | { readonly kind: "preset"; readonly name: string; readonly adjust: readonly number[] }
  | (Extract<Geometry, { kind: "path" }> & { readonly bounds?: PathBounds })
  | { readonly kind: "icon"; readonly name: string }
  | {
      readonly kind: "line"
      readonly from: Point
      readonly to: Point
      readonly points: readonly Point[]
      readonly route: "straight" | "elbow" | "curve"
      readonly arrows: readonly [Arrow, Arrow]
    }

export type Resolved = {
  readonly id: string
  readonly type: "frame" | "shape"
  readonly box: Box
  readonly opacity: number
  readonly fills: readonly ResolvedPaint[]
  readonly strokes: readonly ResolvedPaint[]
  readonly stroke: StrokeStyle | null
  readonly radius: readonly [Px, Px, Px, Px]
  readonly effects: readonly ResolvedEffect[]
  readonly geometry: ResolvedGeometry | null
  readonly text: ResolvedText | null
  readonly clip: boolean
  readonly mask: boolean
  readonly children: readonly Resolved[]
  readonly derived: boolean
}
