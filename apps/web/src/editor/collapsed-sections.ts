import { useState } from "react"
import type { StripSection } from "@/editor/slide-sidebar"

const none: ReadonlySet<number> = new Set()

function stored(deck: string): string {
  return `airdesign.collapsed-sections.${deck}`
}

export function keptCollapsed(deck: string): ReadonlySet<number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(stored(deck)) ?? "[]")
    if (!Array.isArray(value)) return none
    return new Set(value.filter((each): each is number => Number.isInteger(each) && each >= 0))
  } catch {
    return none
  }
}

export function keepCollapsed(deck: string, collapsed: ReadonlySet<number>): void {
  try {
    localStorage.setItem(stored(deck), JSON.stringify([...collapsed].sort((left, right) => left - right)))
  } catch {
    return
  }
}

export function sectionAt(sections: readonly StripSection[], index: number): number {
  let found = -1
  for (const [number, section] of sections.entries()) {
    if (section.start <= index) found = number
  }
  return found
}

export function collapsedSections(
  collapsed: ReadonlySet<number>,
  sections: readonly StripSection[],
  current: number,
): ReadonlySet<number> {
  const open = sectionAt(sections, current)
  return new Set([...collapsed].filter((number) => number < sections.length && number !== open))
}

type Collapsed = {
  readonly held: ReadonlySet<number>
  readonly toggle: (number: number) => void
  readonly open: (number: number) => void
}

export function useKeptCollapsed(deck: string | null, sections: readonly StripSection[], current: number): Collapsed {
  const [held, setHeld] = useState(() => {
    if (deck === null) return none
    const kept = keptCollapsed(deck)
    const shown = collapsedSections(kept, sections, current)
    if (shown.size !== kept.size) keepCollapsed(deck, shown)
    return shown
  })
  const keep = (next: ReadonlySet<number>) => {
    if (deck !== null) keepCollapsed(deck, next)
    setHeld(next)
  }
  const without = (number: number) => new Set([...held].filter((each) => each !== number))
  return {
    held,
    toggle: (number) => keep(held.has(number) ? without(number) : new Set([...held, number])),
    open: (number) => {
      if (held.has(number)) keep(without(number))
    },
  }
}
