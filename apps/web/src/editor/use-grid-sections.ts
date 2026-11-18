import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { gridStop, sectionAt, useKeptCollapsed } from "@/editor/collapsed-sections"
import type { GridStep } from "@/editor/grid-interaction"
import type { GridMenu } from "@/editor/grid-menu"
import { visiblePick, type GridPick } from "@/editor/grid-selection"
import type { GridRange } from "@/editor/grid-drop"
import type { SlideStrip, StripSection } from "@/editor/slide-sidebar"

const noSections: readonly StripSection[] = []

export function useGridSections(deck: string | null, strip: SlideStrip, stop: number) {
  const { count, current, sections = noSections } = strip
  const collapsed = useKeptCollapsed(deck, sections, current)
  const [seen, setSeen] = useState(current)
  if (seen !== current) {
    setSeen(current)
    collapsed.open(sectionAt(sections, current))
  }
  const shown = (index: number) => !collapsed.held.has(sectionAt(sections, index))
  const reachable = gridStop(stop, current, count, shown, sections)
  const collapsedRanges: GridRange[] = []
  for (const [number, { start }] of sections.entries()) {
    if (!collapsed.held.has(number)) continue
    const end = sections[number + 1]?.start ?? count
    const previous = collapsedRanges.at(-1)
    if (previous?.end === start) collapsedRanges.splice(-1, 1, { start: previous.start, end })
    else collapsedRanges.push({ start, end })
  }
  return { collapsed, collapsedRanges, count, current, key: [...collapsed.held].join(","), reachable, sections, shown }
}

export function useGridSectionFocus({
  list,
  folding,
  setStop,
  focus,
  picked,
  selected,
  edit,
  menu,
  dismiss,
}: {
  list: RefObject<HTMLDivElement | null>
  folding: ReturnType<typeof useGridSections>
  setStop: (index: number) => void
  focus: (target: HTMLElement) => void
  picked: GridPick
  selected: ReadonlySet<number>
  edit: { editing: boolean; step: (step: GridStep) => void }
  menu: GridMenu | null
  dismiss: () => void
}) {
  const { collapsed, count, current, key, reachable, sections, shown } = folding
  const toHeading = useRef(false)
  useLayoutEffect(() => {
    if (!toHeading.current) return
    toHeading.current = false
    const first = list.current?.querySelector<HTMLElement>("[data-section-head]")
    if (first !== undefined && first !== null) focus(first)
  }, [key])

  function toggle(number: number) {
    const wasOpen = !collapsed.held.has(number)
    collapsed.toggle(number)
    if (!wasOpen) return
    const remains = (index: number) => shown(index) && sectionAt(sections, index) !== number
    if (reachable !== null && !remains(reachable)) {
      const next = gridStop(reachable, current, count, remains, sections)
      if (next === null) toHeading.current = true
      else setStop(next)
    }
    if ([...selected].some((index) => !remains(index)) || (edit.editing && !remains(current))) {
      const visible = visiblePick(picked, remains)
      edit.step(visible === null ? { kind: "clear" } : { kind: "pick", pick: visible })
    }
    if (menu !== null && !remains(menu.index)) dismiss()
  }

  return { held: collapsed.held, toggle }
}
