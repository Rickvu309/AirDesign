import { type ElementId } from "./element-id.js"
import { flows, layoutAligns, sizings } from "./trait-layout.js"

export type FramingLayout = {
  readonly flow: (typeof flows)[number]
  readonly gap: number
  readonly padding: readonly [number, number, number, number]
  readonly align: (typeof layoutAligns)[number]
  readonly width?: (typeof sizings)[number]
  readonly height?: (typeof sizings)[number]
}

export type FramingFill = { readonly node: ElementId; readonly width: boolean; readonly height: boolean }

export type Framing = {
  readonly backdrop: ElementId
  readonly children: readonly ElementId[]
  readonly layout: FramingLayout
  readonly fills?: readonly FramingFill[]
}
