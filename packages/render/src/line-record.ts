export type CanvasOutline = "box" | "round" | "ellipse" | "line"

export type CanvasLine = {
  readonly color: string
  readonly width: number
  readonly dash: readonly number[] | null
  readonly head?: "triangle" | "stealth" | "diamond" | "oval" | "arrow" | undefined
  readonly tail?: "triangle" | "stealth" | "diamond" | "oval" | "arrow" | undefined
}
