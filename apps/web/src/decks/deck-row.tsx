import type { ReactNode } from "react"
import type { DeckRowData } from "@/decks/sample-decks"

const trimmed = { textBox: "trim-both cap alphabetic" } as const

function SortMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SortLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex h-4 items-center gap-[6.5px]" style={trimmed}>
      {children}
      <SortMark />
    </span>
  )
}

export function DeckRow({
  name,
  edited,
  created,
  preview,
}: {
  name: string
  edited: string
  created?: string
  preview?: ReactNode
}) {
  return (
    <article className="border-b border-line">
      <div className="grid h-[60px] grid-cols-[64px_minmax(0,1fr)_150px_150px] items-center px-3">
        <div className="h-9 w-16 rounded bg-line">{preview}</div>
        <h2 className="truncate pl-4 text-[14px] leading-[18px] font-medium text-foreground" style={trimmed}>{name}</h2>
        <p className="text-[14px] leading-[18px] text-muted-foreground" style={trimmed}>{edited}</p>
        {created ? <p className="text-[14px] leading-[18px] text-muted-foreground" style={trimmed}>{created}</p> : <span />}
      </div>
    </article>
  )
}

export function DeckTable({ rows }: { rows: DeckRowData[] }) {
  return (
    <div className="mt-8">
      <div className="grid h-[26px] grid-cols-[minmax(0,1fr)_150px_150px] items-start px-3 text-[13px] leading-[17px] text-faint">
        <SortLabel>Name</SortLabel>
        <SortLabel>Edited</SortLabel>
        <SortLabel>Created</SortLabel>
      </div>
      <div className="h-px bg-line" />
      {rows.map((deck) => (
        <DeckRow key={deck.name} name={deck.name} edited={deck.edited} created={deck.created} />
      ))}
    </div>
  )
}
