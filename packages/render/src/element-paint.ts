import type { ElementId } from "@airdesign/document"
import type { CanvasChart } from "./chart-record.js"
import type { CanvasEffects } from "./effect-record.js"
import type { CanvasLine, CanvasOutline } from "./line-record.js"
import type { CanvasElement } from "./record.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasLayer } from "./fill-layers.js"
import type { CanvasTable } from "./table-record.js"
import type { CanvasText } from "./text-record.js"

export type CanvasGeometry = {
  readonly preset: string
  readonly adjusts: Readonly<Record<string, number>>
  readonly gradient?: {
    readonly angle: number | null
    readonly path?: {
      readonly kind: "circle" | "rect" | "shape"
      readonly focus: Readonly<Record<"left" | "top" | "right" | "bottom", number>> | null
    }
    readonly stops: readonly { readonly position: number; readonly color: string }[]
  }
}

export type Framing = "auto" | "free"

export type GroupOf = { readonly id: ElementId; readonly box: PaintBox | null; readonly frame?: Framing }

export type CanvasTie = { readonly node: ElementId; readonly site: number }

export type CanvasConnection = { readonly start: CanvasTie | null; readonly end: CanvasTie | null }

export type ElementPaint = {
  readonly key: string
  readonly id: ElementId | null
  readonly group?: GroupOf
  readonly backdrop?: true
  readonly frame?: Framing
  readonly inFrame?: Framing
  readonly held?: number
  readonly opacity?: number
  readonly box: PaintBox | null
  readonly editable: boolean
  readonly movable?: boolean
  readonly placeholder: boolean
  readonly prompt?: string | null
  readonly unshownText?: string
  readonly filled: boolean
  readonly fill: string | null
  readonly line: CanvasLine | null
  readonly effects?: CanvasEffects
  readonly outline: CanvasOutline
  readonly geometry?: CanvasGeometry
  readonly text: CanvasText | null
  readonly table?: CanvasTable
  readonly diagram?: readonly CanvasElement[]
  readonly chart?: CanvasChart
  readonly label?: string
  readonly layers?: readonly CanvasLayer[]
  readonly connection?: CanvasConnection
}
