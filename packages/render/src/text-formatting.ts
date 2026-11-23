import type { ElementLink, LinkEdit, FormatState, ParagraphAlign, SizeStep, TextFormat } from "@airdesign/document"
import type { NodeId } from "@airdesign/doom"
import type { FontStyle } from "@airdesign/fonts"

export type FormatTarget = {
  readonly link: (editing: boolean) => ElementLink | "mixed" | null
  readonly linkTo: (link: LinkEdit, editing: boolean) => void
  readonly selection: (editing: boolean) => boolean
  readonly edits: (node: Element) => boolean
  readonly state: (format: TextFormat, editing: boolean) => FormatState
  readonly apply: (format: TextFormat, editing: boolean) => void
  readonly size: (editing: boolean) => number | "mixed" | null
  readonly resize: (step: SizeStep, editing: boolean) => void
  readonly sizeTo: (size: number, editing: boolean) => void
  readonly align: (editing: boolean) => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign, editing: boolean) => void
  readonly bullet: (editing: boolean) => FormatState
  readonly bullets: (editing: boolean) => void
  readonly weight: (step: 1 | -1, editing: boolean) => void
  readonly fontStyle: (editing: boolean) => FontStyle | "mixed" | null
  readonly weightTo: (style: FontStyle, editing: boolean) => void
}

export type TextFormatting = {
  readonly link: () => ElementLink | "mixed" | null
  readonly linkTo: (link: LinkEdit) => void
  readonly selection: () => boolean
  readonly register: (id: NodeId, target: FormatTarget) => () => void
  readonly aim: (id: NodeId | null, focused?: HTMLElement) => void
  readonly aimed: () => NodeId | null
  readonly typingIn: () => HTMLElement | null
  readonly state: (format: TextFormat) => FormatState | null
  readonly toggle: (format: TextFormat) => void
  readonly size: () => number | "mixed" | null
  readonly resize: (step: SizeStep) => void
  readonly sizeTo: (size: number, focus?: boolean) => void
  readonly align: () => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign) => void
  readonly bullet: () => FormatState | null
  readonly bullets: () => void
  readonly weight: (step: 1 | -1) => void
  readonly fontStyle: () => FontStyle | "mixed" | null
  readonly weightTo: (style: FontStyle) => void
  readonly across: (ids: readonly NodeId[], key: TextKey) => boolean
  readonly together: () => object | null
  readonly changed: () => void
  readonly subscribe: (listener: () => void) => () => void
}

export type TextKey =
  | { readonly toggle: TextFormat }
  | { readonly resize: SizeStep }
  | { readonly place: ParagraphAlign }
  | { readonly bullets: true }
  | { readonly weight: 1 | -1 }
