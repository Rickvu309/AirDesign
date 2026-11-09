import { useEffect, type CSSProperties } from "react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { movedDeckCards } from "@/decks/sample-decks"

const toastWidth = "322.07px"

function MovedToast() {
  return (
    <div
      className="flex h-10 items-center rounded-[10px] bg-foreground pr-4 pl-4 text-[13px] leading-[17px] text-white shadow-[0_8px_24px_rgb(0_0_0/20%)]"
      style={{ width: toastWidth }}
    >
      <span className="min-w-0 flex-1 truncate">Pricing Strategy Review moved to Trash</span>
      <button type="button" className="font-medium text-white">
        Undo
      </button>
    </div>
  )
}

export function DeckMovedToast() {
  useEffect(() => {
    toast.custom(() => <MovedToast />, {
      id: "deck-moved",
      duration: Infinity,
      unstyled: true,
      className: "!animate-none",
      style: { left: 0, width: toastWidth, opacity: 1, transform: "translateY(0)", transition: "none" },
    })
  }, [])
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        {movedDeckCards.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
      <Toaster
        position="top-center"
        offset={12}
        style={{ "--width": toastWidth } as CSSProperties}
        className="![left:calc(50%+124px)]"
      />
    </DeckBrowser>
  )
}
