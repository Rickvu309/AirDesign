import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { DeckGlyph } from "@/decks/deck-glyph"
import { AgentPromo } from "@/decks/agent-promo"
import { account, starredFolders } from "@/decks/sample-decks"
import { deckRoutes, type DeckSection } from "@/decks/deck-routes"
import { cn } from "@/lib/utils"

const sections: {
  id: DeckSection
  label: string
  href: string
  glyph: "clock" | "decks" | "trash" | "gear"
  size: number
}[] = [
  { id: "recents", label: "Recents", href: deckRoutes.recentsGrid, glyph: "clock", size: 16 },
  { id: "all-decks", label: "All decks", href: deckRoutes.allDecksGrid, glyph: "decks", size: 16 },
  { id: "trash", label: "Trash", href: deckRoutes.trash, glyph: "trash", size: 15 },
  { id: "settings", label: "Settings", href: deckRoutes.settings, glyph: "gear", size: 16 },
]

export function DecksShell({
  active,
  children,
  firstVisit = false,
}: {
  active: DeckSection
  children: ReactNode
  firstVisit?: boolean
}) {
  const primary = sections[0]
  const rest = sections.slice(1)
  return (
    <div className="flex h-full w-full">
      <aside className="flex h-full w-[248px] shrink-0 flex-col bg-canvas px-3 pt-3 pb-3">
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2.5 rounded-lg pr-2 pl-2 text-left hover:bg-black/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] leading-none font-semibold text-white">
            {account.initials}
          </span>
          <span className="text-[14px] leading-[21px] font-medium text-foreground">{account.name}</span>
          <span className="text-faint">
            <DeckGlyph name="chevron" size={14} />
          </span>
        </button>
        <label className="relative mt-3 block">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint">
            <DeckGlyph name="search" size={15} />
          </span>
          <Input
            type="search"
            placeholder="Search"
            aria-label="Search"
            className="h-9 rounded-lg border-0 bg-background pl-[33px] text-sm shadow-[0_0_0_1px_var(--line)] placeholder:text-faint focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-primary md:text-sm"
          />
        </label>
        <nav className="mt-4" aria-label="Decks">
          <a
            href={primary.href}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-[14px] leading-[21px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active === primary.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
            )}
            aria-current={active === primary.id ? "page" : undefined}
          >
            <DeckGlyph name={primary.glyph} size={primary.size} />
            {primary.label}
          </a>
          <div className="mt-3 h-px bg-line" />
          <div className="mt-4 flex flex-col gap-0.5">
            {rest.map((section) => (
              <a
                key={section.id}
                href={section.href}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-[14px] leading-[21px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active === section.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
                )}
                aria-current={active === section.id ? "page" : undefined}
              >
                <DeckGlyph name={section.glyph} size={section.size} />
                {section.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="mt-6 flex flex-col gap-0.5">
          <div className="flex h-8 items-center gap-1.5 pr-2.5 pl-2.5 text-[12px] leading-[18px] font-medium text-muted-foreground">
            <span className="text-faint">
              <DeckGlyph name="chevron" size={12} />
            </span>
            Starred
          </div>
          {firstVisit ? (
            <p className="px-2.5 pt-1 text-[13px] leading-[1.45] text-muted-foreground">Star a deck to keep it here.</p>
          ) : (
            starredFolders.map((folder) => (
              <button
                key={folder}
                type="button"
                className="flex h-8 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-left text-[13px] leading-[19.5px] text-quiet hover:bg-black/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="text-muted-foreground">
                  <DeckGlyph name="folder" size={15} />
                </span>
                <span className="truncate">{folder}</span>
              </button>
            ))
          )}
        </div>
        <div className="mt-auto">
          {firstVisit ? (
            <a
              href={deckRoutes.connectAgent}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-background text-[13px] leading-none font-medium text-foreground shadow-[inset_0_0_0_1px_#d7d7d6,0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <DeckGlyph name="plug" size={14} />
              Connect an agent
            </a>
          ) : (
            <AgentPromo />
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-14 pt-10">{children}</main>
    </div>
  )
}
