import type { ReactNode } from "react"
import { NewDeckMenu, type NewDeckActions } from "@/decks/new-deck-menu"
import { ViewSwitch } from "@/decks/view-switch"

export function BrowseHeader({
  title,
  view,
  scope,
  newDeck,
  trailing,
  compact = false,
  links,
}: {
  title: string
  view?: "grid" | "list"
  scope?: "recents" | "all"
  newDeck?: NewDeckActions
  trailing?: ReactNode
  compact?: boolean
  links?: { grid: string; list: string }
}) {
  return (
    <header
      data-decks-header
      className={
        compact
          ? "flex h-9 items-center justify-between max-md:h-auto max-md:flex-wrap max-md:gap-2"
          : "flex h-[39px] items-center justify-between max-md:h-auto max-md:flex-wrap max-md:gap-2"
      }
    >
      <h1
        className={
          compact
            ? "h-[var(--space-32)] text-[26px] leading-[34px] font-semibold tracking-[-0.5px] text-foreground"
            : "h-[39px] text-[26px] leading-[var(--leading-body)] font-semibold tracking-[-0.5px] text-foreground"
        }
      >
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
