import { DangerDialog } from "@/decks/danger-dialog"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { trashDeckCards } from "@/decks/sample-decks"

export function RestoreButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 items-center rounded-md bg-background px-2.5 text-[length:var(--type-caption)] leading-none font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)]"
    >
      Restore
    </button>
  )
}

export function EmptyTrashDialog({
  count = 3,
  busy = false,
  onCancel,
  onConfirm,
}: {
  count?: number
  busy?: boolean
  onCancel?: () => void
  onConfirm?: () => void
}) {
  return (
    <DangerDialog
      title={`Delete ${String(count)} ${count === 1 ? "deck" : "decks"} for good?`}
      body="This can't be undone."
      action="Delete for good"
      busy={busy}
      className="h-[207.5px]"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export function EmptyTrashButton({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-lg bg-background px-3.5 text-sm font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)] disabled:opacity-50"
    >
      Empty Trash
    </button>
  )
}

export function TrashNote() {
  return <p className="mt-6 text-sm leading-[18px] text-faint">Decks here are removed for good after 30 days.</p>
}

export function TrashList({ confirm = false }: { confirm?: boolean }) {
  return (
    <DeckBrowser title="Trash" active="trash" trailing={<EmptyTrashButton />}>
      <TrashNote />
      <DeckGrid className="mt-6">
        {trashDeckCards.map((deck) => (
          <DeckCard
            key={deck.name}
            name={deck.name}
            edited={deck.edited}
            action={<RestoreButton />}
            previewClassName="h-[180px]"
          />
        ))}
      </DeckGrid>
      {confirm ? <EmptyTrashDialog /> : null}
    </DeckBrowser>
  )
}
