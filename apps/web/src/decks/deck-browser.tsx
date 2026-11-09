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
}: {
  title: string
  active: DeckSection
  view?: "grid" | "list"
  scope?: "recents" | "all"
  firstVisit?: boolean
  menu?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="screen-frame">
      <DecksShell active={active} firstVisit={firstVisit}>
        <BrowseHeader title={title} view={view} scope={scope} menu={menu} trailing={trailing} compact={firstVisit} />
        {children}
      </DecksShell>
    </div>
  )
}
