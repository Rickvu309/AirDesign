export type CanvasShadow = {
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly scaleX: number
  readonly scaleY: number
  readonly skewX: number
  readonly skewY: number
  readonly align: string
  readonly rotateWithShape: boolean
  readonly color: string
}

export type CanvasEffects = {
  readonly shadow?: CanvasShadow
  readonly glow?: { readonly radius: number; readonly color: string }
  readonly softEdge?: { readonly radius: number }
}
