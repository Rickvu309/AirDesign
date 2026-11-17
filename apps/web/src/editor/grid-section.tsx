import { defaultGrid1, slideId } from "@airdesign/document"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import type { SlideStrip } from "@/editor/slide-sidebar"
import { cn } from "@/lib/class-names"

export type GridRow = {
  readonly name: string | null
  readonly number: number | null
  readonly start: number
  readonly end: number
}

export function gridRows(strip: SlideStrip): readonly GridRow[] {
  const file = Array.from({ length: strip.count }, (_, index) => slideId(String(index + 1)))
  const starts = strip.gridStarts ?? defaultGrid1(file).starts.map((id) => file.indexOf(id))
  return starts.map((start, index) => ({
    name: null,
    number: null,
    start,
    end: starts[index + 1] ?? strip.count,
  }))
}

export function GridSectionHead({
  name,
  count,
  open,
  onToggle,
  marker = false,
}: {
  name: string
  count: number
  open: boolean
  onToggle: () => void
  marker?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2", !marker && "h-5")}>
      <h2 className="flex min-w-0">
        <button
          type="button"
          aria-expanded={open}
          data-section-head
          className={cn(
            "-ml-1.5 min-w-0 gap-1.5 rounded-md pr-2 pl-1 text-left hover:bg-line",
            marker ? "grid grid-cols-[14px_minmax(0,1fr)] items-start py-1" : "-my-1 flex h-7 items-center",
          )}
          onClick={onToggle}
        >
          <EditorIcon name={open ? "chev" : "chevr"} size={14} className="shrink-0 text-faint" />
          <span
            className={cn(
              "min-w-0 text-[length:var(--type-caption)] font-semibold text-foreground",
              marker ? "wrap-anywhere" : "truncate",
            )}
          >
            {name}
          </span>
          <span
            className={cn(
              "shrink-0 text-[length:var(--type-caption)] text-quiet tabular-nums",
              marker && "col-start-2",
            )}
          >
            {slideListCopy.sectionCount(count)}
          </span>
        </button>
      </h2>
      {marker ? null : <span aria-hidden="true" className="ml-1 block h-px flex-1 bg-line" />}
    </div>
  )
}
