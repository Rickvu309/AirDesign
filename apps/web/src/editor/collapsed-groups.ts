import type { StripGroup } from "@/editor/slide-sidebar"

export function heldGroups(collapsed: ReadonlySet<string>, groups: readonly StripGroup[]): ReadonlySet<number> {
  return new Set(groups.flatMap((group, number) => (collapsed.has(group.key) ? [number] : [])))
}

export function groupAt(groups: readonly StripGroup[], index: number): number {
  let found = -1
  for (const [number, group] of groups.entries()) {
    if (group.start <= index) found = number
  }
  return found
}
