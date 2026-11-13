import type { ElementId, FormatState, ParagraphAlign, RunColor, TextFormat } from "@airdesign/document"
import type { CanvasThemeColor } from "./record.js"

export type FormatTarget = {
  readonly edits: (node: Element) => boolean
  readonly state: (format: TextFormat, editing: boolean) => FormatState
  readonly apply: (format: TextFormat, editing: boolean) => void
  readonly size: (editing: boolean) => number | "mixed" | null
  readonly resize: (points: number, editing: boolean) => void
  readonly color: (editing: boolean) => RunColor | "mixed" | null
  readonly choose: (color: RunColor, editing: boolean) => void
  readonly align: (editing: boolean) => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign, editing: boolean) => void
  readonly bullet: (editing: boolean) => FormatState
  readonly bullets: (editing: boolean) => void
  readonly swatches: () => readonly CanvasThemeColor[]
}

export type TextFormatting = {
  readonly register: (id: ElementId, target: FormatTarget) => () => void
  readonly aim: (id: ElementId | null, focused?: HTMLElement) => void
  readonly state: (format: TextFormat) => FormatState | null
  readonly toggle: (format: TextFormat) => void
  readonly size: () => number | "mixed" | null
  readonly resize: (points: number) => void
  readonly color: () => RunColor | "mixed" | null
  readonly choose: (color: RunColor) => void
  readonly align: () => ParagraphAlign | "mixed" | null
  readonly place: (align: ParagraphAlign) => void
  readonly bullet: () => FormatState | null
  readonly bullets: () => void
  readonly swatches: () => readonly CanvasThemeColor[]
  readonly changed: () => void
  readonly subscribe: (listener: () => void) => () => void
  readonly version: () => number
}

export const keepsFormat = "[data-keeps-format]"
const stillAimed = `${keepsFormat}, [data-canvas-element]`

const formatKeys: Readonly<Record<string, TextFormat>> = { b: "bold", i: "italic", u: "underline" }

export function formatKey(event: {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}): TextFormat | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  return formatKeys[event.key.toLowerCase()] ?? null
}

export function textFormatting(fresh: () => void = () => undefined): TextFormatting {
  const targets = new Map<ElementId, FormatTarget>()
  const listeners = new Set<() => void>()
  let aimed: ElementId | null = null
  let returnTo: HTMLElement | null = null
  let count = 0
  const changed = () => {
    count += 1
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
  const act = (run: (found: FormatTarget, editing: boolean) => void) => {
    const found = target()
    if (found === undefined) return
    const back = returnTo
    if (back !== null && back.isConnected && back.ownerDocument.activeElement !== back) {
      back.focus({ preventScroll: true })
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
    resize(points) {
      act((found, on) => found.resize(points, on))
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
    version: () => count,
  }
}
