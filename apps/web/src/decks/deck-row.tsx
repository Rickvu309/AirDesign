import type { ReactNode } from "react"
import type { DeckRowData } from "@/decks/sample-decks"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/class-names"

const columns = "grid grid-cols-[80px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"

const row = cn("h-16 items-center", columns)
const previewBox = "h-[45px] w-20"
const nameInset = "ml-4"

const trimmed = { textBox: "trim-both cap alphabetic" } as const

function SortMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5 L6 7.5 L9 4.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SortLabel({ children, mark }: { children: string; mark: boolean }) {
  return (
    <span className="inline-flex h-4 items-center gap-[var(--space-8)]" style={trimmed}>
      {children}
      {mark && <SortMark />}
    </span>
  )
}

export function DeckRow({
  name,
  edited,
  created,
  preview,
  href,
}: {
  name: string
  edited: string
  created?: string
  preview?: ReactNode
  href?: string
}) {
  return (
    <article data-deck-row>
      <div className={row}>
        <div
          className={cn(
            previewBox,
            "overflow-hidden rounded-md bg-line [&_[data-deck-initial]]:text-[length:var(--type-title)]",
          )}
        >
          {preview}
        </div>
        <div className={cn(nameInset, "flex min-w-0 items-center gap-1 pr-4")}>
          <h2
            className="min-w-0 truncate py-1 text-[length:var(--type-dense)] leading-[18px] font-medium text-foreground"
            style={trimmed}
          >
            {href ? <a href={href}>{name}</a> : name}
          </h2>
        </div>
        <p className="text-[length:var(--type-dense)] leading-[18px] text-muted-foreground" style={trimmed}>
          {edited}
        </p>
        {created ? (
          <p className="text-[length:var(--type-dense)] leading-[18px] text-muted-foreground" style={trimmed}>
            {created}
          </p>
        ) : (
          <span />
        )}
      </div>
    </article>
  )
}

export function DeckTableHeader({ sortMarks = true }: { sortMarks?: boolean }) {
  return (
    <div className={cn("h-7 items-start text-[length:var(--type-dense)] leading-[17px] text-quiet", columns)}>
      <span className="col-span-2">
        <SortLabel mark={sortMarks}>Name</SortLabel>
      </span>
      <SortLabel mark={sortMarks}>Edited</SortLabel>
      <SortLabel mark={sortMarks}>Created</SortLabel>
    </div>
  )
}

export function DeckTableSkeleton() {
  return (
    <div className="mt-12" data-loading="true" aria-busy="true">
      <DeckTableHeader sortMarks={false} />
      {[0, 1, 2].map((key) => (
        <div key={key} className={row} aria-hidden="true">
          <Skeleton tone="line" className={previewBox} />
          <Skeleton tone="line" className={cn(nameInset, "h-4 w-1/2")} />
          <Skeleton tone="line" className="h-4 w-1/2 max-w-24" />
          <Skeleton tone="line" className="h-4 w-1/2 max-w-24" />
        </div>
      ))}
    </div>
  )
}

export function DeckTable({ rows }: { rows: DeckRowData[] }) {
  return (
    <div className="mt-12">
      <DeckTableHeader />
      {rows.map((deck) => (
        <DeckRow key={deck.name} name={deck.name} edited={deck.edited} created={deck.created} />
      ))}
    </div>
  )
}
