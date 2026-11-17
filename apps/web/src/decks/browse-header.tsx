import type { ReactNode } from "react"
import { NewDeckMenu, type NewDeckActions } from "@/decks/new-deck-menu"
import { ViewSwitch } from "@/decks/view-switch"

export function BrowseHeader({
  title,
  view,
  scope,
  newDeck,
  trailing,
  links,
}: {
  title: string
  view?: "grid" | "list"
  scope?: "recents" | "all"
  newDeck?: NewDeckActions
  trailing?: ReactNode
  links?: { grid: string; list: string }
}) {
  return (
    <header
      data-decks-header
      className="flex h-8 items-center justify-between max-md:h-auto max-md:flex-wrap max-md:gap-2"
    >
      <h1 className="h-8 text-[length:var(--type-title)] leading-8 font-medium tracking-[-0.4px] text-foreground">
        {title}
      </h1>
      {trailing ?? (
        <div className="flex items-center gap-2">
          <NewDeckMenu {...newDeck} />
          {view && (scope || links) ? <ViewSwitch active={view} scope={scope} links={links} /> : null}
        </div>
      )}
    </header>
  )
}
