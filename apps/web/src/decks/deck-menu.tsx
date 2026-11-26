import { useRef, type ReactNode } from "react"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { deckActionsOf, productCopy, starOf, unstarOf } from "@/copy/product-copy"
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

type DeckActionProps = {
  name: string
  starred: boolean
  onStar: () => void
  onTrash: (pointer: boolean) => void
}

export function DeckRowMenu({ children, name, starred, onStar, onTrash }: DeckActionProps & { children: ReactNode }) {
  const trigger = useRef<HTMLDivElement>(null)
  return (
    <ContextMenu>
      <ContextMenuTrigger ref={trigger}>{children}</ContextMenuTrigger>
      <ContextMenuContent
        anchor={() => trigger.current?.querySelector("h2") ?? null}
        side="bottom"
        align="start"
        sideOffset={4}
        finalFocus={() => trigger.current?.querySelector("a") ?? false}
      >
        <ContextMenuItem onClick={onStar}>{starred ? unstarOf(name) : starOf(name)}</ContextMenuItem>
        <ContextMenuItem onClick={(event) => onTrash(event.detail > 0)}>{productCopy.moveToTrash}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function DeckActions({ name, starred, onStar, onTrash }: DeckActionProps) {
  return (
    <div className="flex items-center gap-0.5">
      <StarButton name={name} starred={starred} onClick={onStar} />
      <DeckMenu name={name} onTrash={onTrash} />
    </div>
  )
}
