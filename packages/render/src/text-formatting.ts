import type {
  ElementLink,
  LinkEdit,
  ElementId,
  FormatState,
  ParagraphAlign,
  Color,
  SizeStep,
  TextFormat,
} from "@airdesign/document"
import { gestureFor, type GestureId, type KeyLike } from "./gestures.js"
import type { CanvasTemplateColor } from "./record.js"

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
  readonly color: (editing: boolean) => Color | "mixed" | null
  readonly choose: (color: Color, editing: boolean) => void
  readonly align: (editing: boolean) => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign, editing: boolean) => void
  readonly bullet: (editing: boolean) => FormatState
  readonly bullets: (editing: boolean) => void
  readonly weight: (step: 1 | -1, editing: boolean) => void
  readonly swatches: () => readonly CanvasTemplateColor[]
}

export type TextFormatting = {
  readonly link: () => ElementLink | "mixed" | null
  readonly linkTo: (link: LinkEdit) => void
  readonly selection: () => boolean
  readonly register: (id: ElementId, target: FormatTarget) => () => void
  readonly aim: (id: ElementId | null, focused?: HTMLElement) => void
  readonly aimed: () => ElementId | null
  readonly state: (format: TextFormat) => FormatState | null
  readonly toggle: (format: TextFormat) => void
  readonly size: () => number | "mixed" | null
  readonly resize: (step: SizeStep) => void
  readonly sizeTo: (size: number, focus?: boolean) => void
  readonly color: () => Color | "mixed" | null
  readonly choose: (color: Color) => void
  readonly align: () => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign) => void
  readonly bullet: () => FormatState | null
  readonly bullets: () => void
  readonly weight: (step: 1 | -1) => void
  readonly swatches: () => readonly CanvasTemplateColor[]
  readonly changed: () => void
  readonly subscribe: (listener: () => void) => () => void
}

export const keepsFormat = "[data-keeps-format]"
const stillAimed = `${keepsFormat}, [data-canvas-element]`

export type TextKey =
  | { readonly toggle: TextFormat }
  | { readonly resize: SizeStep }
  | { readonly place: ParagraphAlign }
  | { readonly bullets: true }
  | { readonly weight: 1 | -1 }

const textKeys: Partial<Readonly<Record<GestureId, TextKey>>> = {
  bold: { toggle: "bold" },
  italic: { toggle: "italic" },
  underline: { toggle: "underline" },
  strike: { toggle: "strike" },
  "size-up": { resize: 1 },
  "size-down": { resize: -1 },
  "text-left": { place: "left" },
  "text-center": { place: "center" },
  "text-right": { place: "right" },
  bullets: { bullets: true },
  "weight-up": { weight: 1 },
  "weight-down": { weight: -1 },
}

export function textKeyOf(event: KeyLike): TextKey | null {
  const gesture = gestureFor(event, "text")
  return gesture === null ? null : (textKeys[gesture] ?? null)
}

export function runTextKey(formatting: TextFormatting, key: TextKey) {
  if ("toggle" in key) formatting.toggle(key.toggle)
  else if ("resize" in key) formatting.resize(key.resize)
  else if ("place" in key) formatting.place(key.place)
  else if ("weight" in key) formatting.weight(key.weight)
  else formatting.bullets()
}

export function textFormatting(fresh: () => void = () => undefined): TextFormatting {
  const targets = new Map<ElementId, FormatTarget>()
  const listeners = new Set<() => void>()
  let aimed: ElementId | null = null
  let returnTo: HTMLElement | null = null
  const changed = () => {
    for (const listener of listeners) listener()
  }
  const target = () => (aimed === null ? undefined : targets.get(aimed))
  const left = (event: FocusEvent) => {
    const now = event.target
    if (aimed === null || (now instanceof Element && now.closest(stillAimed) !== null)) return
    aimed = null
    returnTo = null
    changed()
  }
  const editing = (found: FormatTarget) => returnTo !== null && found.edits(returnTo)
  const act = (run: (found: FormatTarget, editing: boolean) => void, focus = true) => {
    const found = target()
    if (found === undefined) return
    const text = returnTo
    if (focus && text !== null && text.isConnected && text.ownerDocument.activeElement !== text) {
      text.focus({ preventScroll: true })
    }
    fresh()
    run(found, editing(found))
    fresh()
    changed()
  }
  return {
    register(id, found) {
      targets.set(id, found)
      changed()
      return () => {
        if (targets.get(id) !== found) return
        targets.delete(id)
        changed()
      }
    },
    aim(id, focused) {
      if (aimed === id && (focused === undefined || returnTo === focused)) return
      aimed = id
      returnTo = id === null ? null : (focused ?? null)
      changed()
    },
    aimed() {
      return aimed
    },
    link() {
      const found = target()
      return found === undefined ? null : found.link(editing(found))
    },
    linkTo(link) {
      act((found, on) => found.linkTo(link, on), false)
    },
    selection() {
      const found = target()
      return found !== undefined && found.selection(editing(found))
    },
    state(format) {
      const found = target()
      return found === undefined ? null : found.state(format, editing(found))
    },
    toggle(format) {
      act((found, on) => found.apply(format, on))
    },
    size() {
      const found = target()
      return found === undefined ? null : found.size(editing(found))
    },
    resize(step) {
      act((found, on) => found.resize(step, on))
    },
    sizeTo(size, focus) {
      act((found, on) => found.sizeTo(size, on), focus)
    },
    color() {
      const found = target()
      return found === undefined ? null : found.color(editing(found))
    },
    choose(color) {
      act((found, on) => found.choose(color, on))
    },
    align() {
      const found = target()
      return found === undefined ? null : found.align(editing(found))
    },
    place(align) {
      act((found, on) => found.place(align, on))
    },
    bullet() {
      const found = target()
      return found === undefined ? null : found.bullet(editing(found))
    },
    bullets() {
      act((found, on) => found.bullets(on))
    },
    weight(step) {
      act((found, on) => found.weight(step, on))
    },
    swatches() {
      return target()?.swatches() ?? []
    },
    changed,
    subscribe(listener) {
      listeners.add(listener)
      const document = globalThis.document
      document?.addEventListener("selectionchange", changed)
      document?.addEventListener("focusin", left)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        document?.removeEventListener("selectionchange", changed)
        document?.removeEventListener("focusin", left)
      }
    },
  }
}
