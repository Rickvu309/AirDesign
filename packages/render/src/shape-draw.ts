export type ShapeKind = "box" | "line"

export type DrawnBox = {
  readonly x: number
  readonly y: number
  readonly cx: number
  readonly cy: number
  readonly flipH: boolean
  readonly flipV: boolean
}
