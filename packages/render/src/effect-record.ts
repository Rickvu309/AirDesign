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

export type CanvasInner = {
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly color: string
}

export type CanvasEffects = {
  readonly shadow?: CanvasShadow
  readonly innerShadow?: CanvasInner
  readonly glow?: { readonly radius: number; readonly color: string }
  readonly softEdge?: { readonly radius: number }
  readonly blur?: { readonly radius: number }
  readonly drops?: readonly CanvasShadow[]
  readonly inners?: readonly CanvasInner[]
}
