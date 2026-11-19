import type { Paint } from "@airdesign/document"
import type { MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"

type Gradient = Extract<Paint, { readonly gradient: unknown }>["gradient"]
export type EditorShade = Exclude<Gradient["shade"], { readonly linear: unknown } | { readonly path: unknown }>

const attrs =
  ' xmlns:adg="https://airdesign.app/drawing/gradient" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="adg"'

export function editorGradientAttrs(shade: EditorShade): string {
  const [kind, geometry] =
    "angular" in shade ? (["angular", shade.angular] as const) : (["diamond", shade.diamond] as const)
  const values = Object.entries(geometry)
    .map(([key, value]) => ` adg:${key}="${String(value)}"`)
    .join("")
  return `${attrs} adg:kind="${kind}"${values}`
}

function coordinate(element: MarkupElement, name: string, min: number, max: number): number | null {
  const text = paintAttribute(element, `adg:${name}`)
  if (text === null || !/^\d+$/.test(text)) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

export function editorShade(element: MarkupElement): EditorShade | null {
  const kind = paintAttribute(element, "adg:kind")
  if (kind !== "angular" && kind !== "diamond") return null
  const x = coordinate(element, "x", 0, 100_000)
  const y = coordinate(element, "y", 0, 100_000)
  if (x === null || y === null) return null
  if (kind === "angular") {
    const angle = coordinate(element, "angle", 0, 21_599_999)
    return angle === null ? null : { angular: { angle, x, y } }
  }
  const width = coordinate(element, "width", 1, 100_000)
  const height = coordinate(element, "height", 1, 100_000)
  return width === null || height === null ? null : { diamond: { x, y, width, height } }
}
