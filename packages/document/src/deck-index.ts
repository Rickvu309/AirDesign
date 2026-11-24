import { type ElementLink } from "./link-target.js"
import { type TextStyle } from "./text-style.js"
import { type Box } from "./box.js"
import { type Design, type DesignKey, type Palette, type Role } from "./design.js"
import { type ElementId, type SlideId } from "./element-id.js"
import { type TemplateStyle } from "./template-style.js"
import { type IndexArrangement } from "./index-slide-arrangement.js"
import { type IndexLayout } from "./index-layout.js"
import { type Kind } from "./kinds.js"
import type { ElementPatch } from "./trait-patch.js"
import { type Framing } from "./frame-index.js"

export type SlideSize = { readonly width: number; readonly height: number }
export type IndexSlide = {
  readonly id: string
  readonly position: number
  readonly size?: SlideSize
  readonly free?: number
  readonly animated?: readonly string[]
  readonly layout?: readonly IndexElement[]
  readonly skipped?: true
  readonly templateStyle?: string
  readonly textStyles?: readonly TextStyle[] | string
  readonly palette?: number
} & IndexArrangement
export type IndexElement = {
  readonly link?: ElementLink
  readonly node: ElementId
  readonly kind: Kind
  readonly value: string | null
  readonly box: Box | null
  readonly grouped: boolean
  readonly role?: Role
  readonly design?: Design
  readonly kept?: readonly DesignKey[]
  readonly placed?: Box
  readonly group?: ElementId
  readonly frame?: Box
  readonly framing?: Framing
  readonly opening?: ElementPatch
}
type BuiltIndex = {
  readonly format?: number
  readonly total: number
  readonly sectionStarts?: readonly SlideId[]
  readonly templateStyles?: readonly TemplateStyle[]
  readonly palettes?: readonly Palette[]
  readonly layouts?: readonly IndexLayout[]
  readonly slides: readonly IndexSlide[]
  readonly elements: readonly IndexElement[]
  readonly pages: readonly { readonly once: string; readonly offset: number; readonly count: number }[]
}
export type DeckIndex = BuiltIndex & { readonly next?: BuiltIndex }

export function indexedSectionStarts(index: DeckIndex | undefined): readonly SlideId[] | undefined {
  return index !== undefined && index.total === index.elements.length ? index.sectionStarts : undefined
}
