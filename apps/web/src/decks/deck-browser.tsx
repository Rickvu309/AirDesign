import type { ReactNode } from "react"
import { BrowseHeader } from "@/decks/browse-header"
import { DecksShell } from "@/decks/decks-shell"
import type { DeckSection } from "@/decks/deck-routes"

export function DeckBrowser({
  title,
  active,
  view,
  scope,
  firstVisit = false,
  menu,
  trailing,
  children,
  account,
  links,
  onNewDeck,
  onSignOut,
  onNavigate,
  menuOpen,
  search,
  starred,
}: {
  title: string
  active: DeckSection
  view?: "grid" | "list"
  scope?: "recents" | "all"
  firstVisit?: boolean
  menu?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  account?: { email: string }
  links?: { grid: string; list: string }
  onNewDeck?: () => void
  onSignOut?: () => void
  onNavigate?: (path: string) => void
  menuOpen?: boolean
  search?: { value: string; onChange: (value: string) => void }
  starred?: readonly { readonly deck: string; readonly name: string }[]
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
        <BrowseHeader
          title={title}
          view={view}
          scope={scope}
          menu={menu}
          trailing={trailing}
          compact={firstVisit}
          links={links}
          onNewDeck={onNewDeck}
          menuOpen={menuOpen}
        />
        {children}
      </DecksShell>
    </div>
  )
}
