import { defaultGrid1, slideId } from "@airdesign/document"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { sectionAt } from "@/editor/collapsed-sections"
import type { SlideStrip, StripSection } from "@/editor/slide-sidebar"
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

const sectionNameStyle = "text-[length:var(--type-caption)] font-semibold text-foreground"

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
  const label = useRef<HTMLSpanElement>(null)
  const sample = useRef<HTMLSpanElement>(null)
  const letters = Array.from(name)
  const shortest = letters.length > 3 ? `${letters.slice(0, 3).join("")}…` : name
  useLayoutEffect(() => {
    const text = label.current
    const minimum = sample.current
    if (text === null || minimum === null) return
    const resize = () => {
      text.style.visibility =
        text.getBoundingClientRect().width + 0.25 < minimum.getBoundingClientRect().width ? "hidden" : ""
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(text)
    observer.observe(minimum)
    return () => observer.disconnect()
  }, [marker, name])
  return (
    <div className="flex h-5 min-w-0 items-center gap-2" style={marker ? { containerType: "inline-size" } : undefined}>
      <h2 className="flex min-w-0 max-w-full">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${name} ${slideListCopy.sectionCount(count)}`}
          title={name}
          data-section-head
          className={cn(
            "flex min-w-0 max-w-full items-center gap-1.5 rounded-md text-left hover:bg-line",
            marker ? "h-5" : "-my-1 -ml-1.5 h-7 pr-2 pl-1",
          )}
          onClick={onToggle}
        >
          <EditorIcon name={open ? "chev" : "chevr"} size={14} className="shrink-0 text-faint" />
          <span ref={label} className={cn(sectionNameStyle, "min-w-0 truncate")}>
            {name}
          </span>
          <span
            className={cn(
              "shrink-0 text-[length:var(--type-caption)] text-quiet tabular-nums",
              marker && "@max-[160px]:hidden",
            )}
          >
            {slideListCopy.sectionCount(count)}
          </span>
        </button>
      </h2>
      {marker ? (
        <span ref={sample} aria-hidden="true" className={cn(sectionNameStyle, "invisible absolute whitespace-nowrap")}>
          {shortest}
        </span>
      ) : (
        <span aria-hidden="true" className="ml-1 block h-px flex-1 bg-line" />
      )}
    </div>
  )
}

export function GridSectionCell({
  row,
  index,
  sections,
  count,
  scale,
  pitch,
  held,
  onToggle,
  shown,
  height,
  children,
}: {
  row: GridRow
  index: number
  sections: readonly StripSection[]
  count: number
  scale: number
  pitch: number
  held: ReadonlySet<number>
  onToggle: (number: number) => void
  shown: boolean
  height: number
  children: ReactNode
}) {
  const offset = index - row.start
  const section = sections.find((section) => section.start === index)
  const number = sectionAt(sections, index)
  const next = sections[number + 1]?.start ?? count
  const canvas = `calc(var(--grid-heading-edge, 0px) - ${offset * pitch * scale}px)`
  const available = next < row.end ? `min(${canvas}, ${(next - index) * pitch * scale - 4}px)` : canvas
  const marked = sections.some((section) => section.start >= row.start && section.start < row.end)
  return (
    <div className="contents">
      {section === undefined ? null : (
        <div style={{ gridColumn: offset + 1, gridRow: 1 }}>
          <div
            style={{
              zoom: 1 / scale,
              width: `max(0px, ${available})`,
            }}
          >
            <GridSectionHead
              marker
              name={section.name}
              count={next - section.start}
              open={!held.has(number)}
              onToggle={() => onToggle(number)}
            />
          </div>
        </div>
      )}
      <div
        style={{ gridColumn: offset + 1, gridRow: marked ? 2 : 1, visibility: shown ? "visible" : "hidden" }}
        aria-hidden={!shown}
      >
        {shown ? children : <div style={{ height: height + 24 }} />}
      </div>
    </div>
  )
}
