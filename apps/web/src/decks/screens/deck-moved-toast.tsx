import { useEffect } from "react"
import { toast } from "@/components/ui/toast"
import { pageToastWidth, PageToaster } from "@/components/ui/page-notice"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { movedDeckCards } from "@/decks/sample-decks"

export function MovedToast({
  name = "Pricing Strategy Review",
  onUndo,
}: {
  name?: string
  onUndo?: (pointer: boolean) => void
}) {
  return (
    <StatusPill className="h-auto min-h-10 max-w-full gap-2.5 py-1.5 pr-4 pl-4" style={{ width: pageToastWidth }}>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline">
        <bdi title={name} className="line-clamp-2 max-w-full shrink-0 [overflow-wrap:anywhere]">
          {name}
        </bdi>
        <span className="shrink-0 whitespace-pre"> moved to Trash</span>
      </span>
      <button
        type="button"
        onClick={(event) => onUndo?.(event.detail > 0)}
        className="shrink-0 font-medium whitespace-nowrap"
      >
        {productCopy.undo}
      </button>
    </StatusPill>
  )
}

export const stillMovedToastOptions = {
  unstyled: true,
  className: "!animate-none",
  style: { left: 0, width: pageToastWidth, opacity: 1, transform: "translateY(0)", transition: "none" },
}

export function DeckMovedToast() {
  useEffect(() => {
    toast.notice(() => <MovedToast />, { id: "deck-moved", duration: Infinity, ...stillMovedToastOptions })
  }, [])
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        {movedDeckCards.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
      <PageToaster />
    </DeckBrowser>
  )
}
