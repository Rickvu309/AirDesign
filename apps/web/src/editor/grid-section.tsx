import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import type { SlideStrip, StripSection } from "@/editor/slide-sidebar"

export type GridRow = {
  readonly name: string | null
  readonly number: number | null
  readonly start: number
  readonly end: number
}

const noSections: readonly StripSection[] = []

export function gridRows(strip: SlideStrip): readonly GridRow[] {
  const sections = strip.sections ?? noSections
  if (sections.length === 0) return [{ name: null, number: null, start: 0, end: strip.count }]
  const rows: GridRow[] = sections.map((section, number) => ({
    name: section.name,
    number,
    start: section.start,
    end: sections[number + 1]?.start ?? strip.count,
  }))
  const first = sections[0]
  if (first !== undefined && first.start > 0) rows.unshift({ name: null, number: null, start: 0, end: first.start })
  return rows
}

export function GridSectionHead({
  name,
  count,
  open,
  onToggle,
}: {
  name: string
  count: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex h-5 items-center gap-2">
      <h2 className="flex min-w-0">
        <button
          type="button"
          aria-expanded={open}
          data-section-head
          className="-my-1 -ml-1.5 flex h-7 min-w-0 items-center gap-1.5 rounded-md pr-2 pl-1 text-left hover:bg-line"
          onClick={onToggle}
        >
          <EditorIcon name={open ? "chev" : "chevr"} size={14} className="shrink-0 text-faint" />
          <span className="min-w-0 truncate text-[length:var(--type-caption)] font-semibold text-foreground">
            {name}
          </span>
          <span className="shrink-0 text-[length:var(--type-caption)] text-quiet tabular-nums">
            {slideListCopy.sectionCount(count)}
          </span>
        </button>
      </h2>
      <span aria-hidden="true" className="ml-1 block h-px flex-1 bg-line" />
    </div>
  )
}
