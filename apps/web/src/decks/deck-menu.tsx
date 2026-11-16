import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { deckActionsOf, productCopy } from "@/copy/product-copy"
import { DeckGlyph } from "@/decks/deck-glyph"
import { StarButton } from "@/decks/star-button"

export function DeckMenu({ name, onTrash }: { name: string; onTrash: (pointer: boolean) => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={deckActionsOf(name)}
            className="text-muted-foreground hover:bg-line"
          />
        }
      >
        <DeckGlyph name="more" size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem onClick={(event) => onTrash(event.detail > 0)}>{productCopy.moveToTrash}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DeckActions({
  name,
  starred,
  onStar,
  onTrash,
}: {
  name: string
  starred: boolean
  onStar: () => void
  onTrash: (pointer: boolean) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      <StarButton name={name} starred={starred} onClick={onStar} />
      <DeckMenu name={name} onTrash={onTrash} />
    </div>
  )
}
