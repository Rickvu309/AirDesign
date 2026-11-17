import { cn } from "@/lib/class-names"
import { deckRoutes } from "@/decks/deck-routes"
import { DeckGlyph } from "@/decks/deck-glyph"

export function ViewSwitch({
  active,
  scope = "recents",
  links,
}: {
  active: "grid" | "list"
  scope?: "recents" | "all"
  links?: { grid: string; list: string }
}) {
  const gridHref = links?.grid ?? (scope === "recents" ? deckRoutes.recentsGrid : deckRoutes.allDecksGrid)
  const listHref = links?.list ?? (scope === "recents" ? deckRoutes.recentsList : deckRoutes.allDecksList)
  return (
    <div className="flex h-7 w-[54px] items-center gap-0.5 rounded-lg bg-canvas p-0.5" role="group" aria-label="Layout">
      <a
        href={gridHref}
        className={cn(
          "flex size-6 items-center justify-center rounded-md",
          active === "grid"
            ? "bg-background text-foreground shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/4%)]"
            : "text-muted-foreground",
        )}
        aria-label="Grid view"
        aria-current={active === "grid" ? "page" : undefined}
      >
        <DeckGlyph name="grid" size={14} />
      </a>
      <a
        href={listHref}
        className={cn(
          "flex size-6 items-center justify-center rounded-md",
          active === "list"
            ? "bg-background text-foreground shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/4%)]"
            : "text-muted-foreground",
        )}
        aria-label="List view"
        aria-current={active === "list" ? "page" : undefined}
      >
        <DeckGlyph name="list" size={14} />
      </a>
    </div>
  )
}
