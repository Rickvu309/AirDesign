import type { ReactNode } from "react"
import type { DeckRowData } from "@/decks/sample-decks"

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
  action,
}: {
  name: string
  edited: string
  created?: string
  preview?: ReactNode
  href?: string
  action?: ReactNode
}) {
  return (
    <article className="border-b border-line">
      <div className="grid h-[60px] grid-cols-[64px_minmax(0,1fr)_150px_150px] items-center px-3">
        <div className="h-9 w-16 rounded bg-line">{preview}</div>
        <div className="flex min-w-0 items-center gap-1 pl-4">
          <h2
            className="min-w-0 truncate py-1 text-[length:var(--type-body)] leading-[18px] font-medium text-foreground"
            style={trimmed}
          >
            {href ? <a href={href}>{name}</a> : name}
          </h2>
          {action}
        </div>
        <p className="text-[length:var(--type-body)] leading-[18px] text-muted-foreground" style={trimmed}>
          {edited}
        </p>
        {created ? (
          <p className="text-[length:var(--type-body)] leading-[18px] text-muted-foreground" style={trimmed}>
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
    <>
      <div className="grid h-[var(--space-24)] grid-cols-[minmax(0,1fr)_150px_150px] items-start px-3 text-[length:var(--type-dense)] leading-[17px] text-quiet">
        <SortLabel mark={sortMarks}>Name</SortLabel>
        <SortLabel mark={sortMarks}>Edited</SortLabel>
        <SortLabel mark={sortMarks}>Created</SortLabel>
      </div>
      <div className="h-px bg-line" />
    </>
  )
}

export function DeckTable({ rows }: { rows: DeckRowData[] }) {
  return (
    <div className="mt-8">
      <DeckTableHeader />
      {rows.map((deck) => (
        <DeckRow key={deck.name} name={deck.name} edited={deck.edited} created={deck.created} />
      ))}
    </div>
  )
}
