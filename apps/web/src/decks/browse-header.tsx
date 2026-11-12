import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ViewSwitch } from "@/decks/view-switch"

export function BrowseHeader({
  title,
  view,
  scope,
  menu,
  trailing,
  compact = false,
  links,
  onNewDeck,
  menuOpen,
}: {
  title: string
  view?: "grid" | "list"
  scope?: "recents" | "all"
  menu?: ReactNode
  trailing?: ReactNode
  compact?: boolean
  links?: { grid: string; list: string }
  onNewDeck?: () => void
  menuOpen?: boolean
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
          <div className="relative">
            <Button
              variant="default"
              className="h-9 gap-2 px-3.5"
              type="button"
              onClick={onNewDeck}
              aria-expanded={menuOpen}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
                <path
                  d="M7 2.92 V11.08 M2.92 7 H11.08"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.28"
                  strokeLinecap="round"
                />
              </svg>
              New deck
            </Button>
            {menu}
          </div>
          {view && (scope || links) ? <ViewSwitch active={view} scope={scope} links={links} /> : null}
        </div>
      )}
    </header>
  )
}
