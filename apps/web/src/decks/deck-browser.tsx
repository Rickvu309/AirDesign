import type { ReactNode } from "react"
import { BrowseHeader } from "@/decks/browse-header"
import type { NewDeckActions } from "@/decks/new-deck-menu"
import { DecksShell } from "@/decks/decks-shell"
import type { DeckSection } from "@/decks/deck-routes"

export function DeckBrowser({
  title,
  active,
  view,
  scope,
  firstVisit = false,
  newDeck,
  trailing,
  children,
  account,
  links,
  onSignOut,
  onNavigate,
  search,
  starred,
}: {
  title: string
  active: DeckSection
  view?: "grid" | "list"
  scope?: "recents" | "all"
  firstVisit?: boolean
  newDeck?: NewDeckActions
  trailing?: ReactNode
  children: ReactNode
  account?: { email: string }
  links?: { grid: string; list: string }
  onSignOut?: () => void
  onNavigate?: (path: string) => void
  search?: { value: string; onChange: (value: string) => void }
  starred?: readonly { readonly deck: string; readonly name: string; readonly scene?: object }[]
}) {
  return (
    <div className="screen-frame reflow-frame">
      <DecksShell
        active={active}
        firstVisit={firstVisit}
        account={account}
        onSignOut={onSignOut}
        onNavigate={onNavigate}
        search={search}
        starred={starred}
      >
        <BrowseHeader title={title} view={view} scope={scope} newDeck={newDeck} trailing={trailing} links={links} />
        {children}
      </DecksShell>
    </div>
  )
}
