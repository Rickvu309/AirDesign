import type { StripSection } from "@/editor/slide-sidebar"

export function heldSections(collapsed: ReadonlySet<string>, sections: readonly StripSection[]): ReadonlySet<number> {
  return new Set(sections.flatMap((section, number) => (collapsed.has(section.key) ? [number] : [])))
}

export function sectionAt(sections: readonly StripSection[], index: number): number {
  let found = -1
  for (const [number, section] of sections.entries()) {
    if (section.start <= index) found = number
  }
  return found
}
