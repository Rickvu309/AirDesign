import type { ElementId, FormatState, TextFormat } from "@airdesign/document"

export type FormatTarget = {
  readonly edits: (node: Element) => boolean
  readonly state: (format: TextFormat, editing: boolean) => FormatState
  readonly apply: (format: TextFormat, editing: boolean) => void
}

export type TextFormatting = {
  readonly register: (id: ElementId, target: FormatTarget) => () => void
  readonly aim: (id: ElementId | null, focused?: HTMLElement) => void
  readonly state: (format: TextFormat) => FormatState | null
  readonly toggle: (format: TextFormat) => void
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
      const found = target()
      if (found === undefined) return
      const back = returnTo
      if (back !== null && back.isConnected && back.ownerDocument.activeElement !== back)
        back.focus({ preventScroll: true })
      fresh()
      found.apply(format, editing(found))
      fresh()
      changed()
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
