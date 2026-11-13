import { Button } from "@/components/ui/button"
import { starOf, unstarOf } from "@/copy/product-copy"
import { DeckGlyph } from "@/decks/deck-glyph"

export function StarButton({ name, starred, onClick }: { name: string; starred: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={starred ? unstarOf(name) : starOf(name)}
      data-starred={starred ? "true" : undefined}
      className={starred ? "text-foreground" : "text-muted-foreground"}
      onClick={onClick}
    >
      <DeckGlyph name={starred ? "starred" : "star"} size={16} />
    </Button>
  )
}
