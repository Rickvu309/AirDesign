import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { emptyTrashTitleOf, productCopy } from "@/copy/product-copy"
import { DangerDialog } from "@/decks/danger-dialog"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { trashDeckCards } from "@/decks/sample-decks"
import { SampleSlide } from "@/decks/screens/sample-slide"

export function RestoreButton({ onClick }: { onClick?: (pointer: boolean) => void }) {
  return (
    <Button type="button" variant="outline-field" size="compact" onClick={(event) => onClick?.(event.detail > 0)}>
      Restore
    </Button>
  )
}

export function EmptyTrashDialog({
  count = 3,
  busy = false,
  children,
  onCancel,
  onConfirm,
}: {
  count?: number
  busy?: boolean
  children?: ReactNode
  onCancel?: () => void
  onConfirm?: () => void
}) {
  return (
    <DangerDialog
      title={emptyTrashTitleOf(count)}
      body={productCopy.trashEmptyBody}
      action={productCopy.trashEmptyAction}
      busy={busy}
      className={children === undefined ? "h-[207.5px]" : "pb-6"}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {children}
    </DangerDialog>
  )
}

export function EmptyTrashButton({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return (
    <Button type="button" variant="outline-field" size="compact" disabled={disabled} onClick={onClick}>
      Empty Trash
    </Button>
  )
}

export function TrashNote() {
  return (
    <p className="mt-6 text-[length:var(--type-dense)] leading-[18px] text-quiet">
      Decks here are removed for good after 30 days.
    </p>
  )
}

export function TrashList({ confirm = false }: { confirm?: boolean }) {
  return (
    <DeckBrowser title="Trash" active="trash" trailing={<EmptyTrashButton />}>
      <TrashNote />
      <DeckGrid className="mt-6 grid-cols-3">
        {trashDeckCards.map((deck) => (
          <DeckCard
            key={deck.name}
            name={deck.name}
            edited={deck.edited}
            action={<RestoreButton />}
            previewClassName="h-[136px]"
            preview={<SampleSlide name={deck.name} />}
          />
        ))}
      </DeckGrid>
      {confirm ? <EmptyTrashDialog /> : null}
    </DeckBrowser>
  )
}
