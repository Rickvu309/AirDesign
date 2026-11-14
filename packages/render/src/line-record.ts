export type CanvasOutline = "box" | "round" | "ellipse" | "line"

export type CanvasArrowSize = { readonly width: number; readonly length: number }

export type CanvasLine = {
  readonly color: string
  readonly width: number
  readonly dash: readonly number[] | null
  readonly head?: "triangle" | "stealth" | "diamond" | "oval" | "arrow" | undefined
  readonly tail?: "triangle" | "stealth" | "diamond" | "oval" | "arrow" | undefined
  readonly headSize?: CanvasArrowSize
  readonly tailSize?: CanvasArrowSize
  readonly cap?: "round" | "square" | "butt"
  readonly join?: { readonly kind: "round" | "bevel" | "miter"; readonly limit?: number }
  readonly compound?: "dbl" | "thickThin" | "thinThick" | "tri"
}
