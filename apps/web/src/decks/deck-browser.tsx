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
  home,
  onNewDeck,
  onSignOut,
  menuOpen,
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
  home?: boolean
  onNewDeck?: () => void
  onSignOut?: () => void
  menuOpen?: boolean
}) {
  return (
    <div className="screen-frame">
      <div className="h-full bg-canvas">
        <DecksShell active={active} firstVisit={firstVisit} account={account} onSignOut={onSignOut}>
          <BrowseHeader
            title={title}
            view={view}
            scope={scope}
            menu={menu}
            trailing={trailing}
            compact={firstVisit}
            home={home}
            onNewDeck={onNewDeck}
            menuOpen={menuOpen}
          />
          {children}
        </DecksShell>
      </div>
    </div>
  )
}
