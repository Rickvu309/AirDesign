export type Point = readonly [number, number]
export type Matrix = readonly [number, number, number, number, number, number]
export type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export type Pen = { readonly kind: "pen"; readonly style: number; readonly width: number; readonly color: string }
export type Brush = {
  readonly kind: "brush"
  readonly style: number
  readonly color: string
  readonly hatch: number
  readonly pattern: string | null
}
export type Font = {
  readonly kind: "font"
  readonly height: number
  readonly escapement: number
  readonly weight: number
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly family: number
  readonly face: string
}
export type Handle = Pen | Brush | Font | { readonly kind: "other" }

export type Mapping = {
  readonly mode: number
  readonly windowOrigin: Point
  readonly windowExtent: Point
  readonly viewportOrigin: Point
  readonly viewportExtent: Point
  readonly world: Matrix
}

export type DrawState = {
  readonly mapping: Mapping
  readonly pen: Pen
  readonly brush: Brush
  readonly font: Font
  readonly textColor: string
  readonly backColor: string
  readonly backMode: number
  readonly align: number
  readonly fillMode: number
  readonly clip: string | null
  readonly at: Point
}

export const identity: Matrix = [1, 0, 0, 1, 0, 0]
export const anisotropic = 8
export const isotropic = 7
export const opaqueBack = 2
export const nullStyle = 5

export function colorOf(reference: number): string {
  const red = reference & 255
  const green = (reference >> 8) & 255
  const blue = (reference >> 16) & 255
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`
}

const black = colorOf(0)
const white = colorOf(0xffffff)

export const blackPen: Pen = { kind: "pen", style: 0, width: 0, color: black }

export function solidBrush(color: string): Brush {
  return { kind: "brush", style: 0, color, hatch: 0, pattern: null }
}

export const systemFont: Font = {
  kind: "font",
  height: -16,
  escapement: 0,
  weight: 400,
  italic: false,
  underline: false,
  strike: false,
  family: 0,
  face: "Arial",
}

const gray = (level: number) => solidBrush(colorOf(level * 0x010101))

export const stockHandles: ReadonlyMap<number, Handle> = new Map<number, Handle>([
  [0, gray(255)],
  [1, gray(192)],
  [2, gray(128)],
  [3, gray(64)],
  [4, gray(0)],
  [5, { ...solidBrush(white), style: 1 }],
  [6, { kind: "pen", style: 0, width: 0, color: white }],
  [7, blackPen],
  [8, { kind: "pen", style: nullStyle, width: 0, color: black }],
  [10, systemFont],
  [11, systemFont],
  [12, systemFont],
  [13, systemFont],
  [14, systemFont],
  [16, systemFont],
  [17, systemFont],
  [18, gray(255)],
  [19, blackPen],
])

export function startState(mapping: Mapping): DrawState {
  return {
    mapping,
    pen: blackPen,
    brush: gray(255),
    font: systemFont,
    textColor: black,
    backColor: white,
    backMode: opaqueBack,
    align: 0,
    fillMode: 1,
    clip: null,
    at: [0, 0],
  }
}

export function multiplied(first: Matrix, then: Matrix): Matrix {
  const [a, b, c, d, e, f] = first
  const [p, q, r, s, t, u] = then
  return [a * p + b * r, a * q + b * s, c * p + d * r, c * q + d * s, e * p + f * r + t, e * q + f * s + u]
}

export function applied(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix
  return [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f]
}

export function scaleOf(matrix: Matrix): number {
  return Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]))
}

export function round(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export function escaped(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}
