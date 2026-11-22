import type { ElementId } from "@airdesign/document"
import type { ToneScope } from "@/aira/aira-prompts"
import type { ToneControlFor } from "@/editor/adjust-tone"

export type ToneLink = {
  readonly publish: (toneFor: ToneControlFor | null) => void
  readonly current: () => ToneControlFor | null
  readonly subscribe: (listener: () => void) => () => void
}

export type ToneSource = {
  readonly link: ToneLink
  readonly scope: (node: ElementId) => ToneScope | null
}

export function toneLink(): ToneLink {
  const listeners = new Set<() => void>()
  let held: ToneControlFor | null = null
  return {
    publish(toneFor) {
      if (held === toneFor) return
      held = toneFor
      for (const listener of listeners) listener()
    },
    current: () => held,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
