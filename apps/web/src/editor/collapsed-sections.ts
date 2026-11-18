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

export function keepCollapsed(deck: string, collapsed: ReadonlySet<number>, current?: number): void {
  try {
    localStorage.setItem(stored(deck), JSON.stringify([...collapsed].sort((left, right) => left - right)))
    if (current !== undefined) localStorage.setItem(`${stored(deck)}.current`, String(current))
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

function keptCurrent(deck: string): string | null {
  try {
    return localStorage.getItem(`${stored(deck)}.current`)
  } catch {
    return null
  }
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
    const shown = collapsedSections(kept, sections, keptCurrent(deck) === String(current) ? -1 : current)
    if (shown.size !== kept.size) keepCollapsed(deck, shown, current)
    return shown
  })
  const keep = (next: ReadonlySet<number>) => {
    if (deck !== null) keepCollapsed(deck, next, current)
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

export function gridStop(
  stop: number,
  current: number,
  count: number,
  shown: (index: number) => boolean,
  sections: readonly StripSection[],
): number | null {
  const start = stop >= 0 && stop < count ? stop : current
  for (let index = start; index < count; index++) if (shown(index)) return index
  for (let index = start - 1; index >= 0; index--)
    if (shown(index)) return sections[sectionAt(sections, index)]?.start ?? 0
  return null
}
