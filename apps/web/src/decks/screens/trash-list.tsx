import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { trashDeckCards } from "@/decks/sample-decks"

function RestoreButton() {
  return (
    <button
      type="button"
      className="flex h-7 items-center rounded-md bg-background px-2.5 text-[length:var(--type-caption)] leading-none font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)]"
    >
      Restore
    </button>
  )
}

function EmptyTrashDialog() {
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay className="bg-black/25 duration-0 data-open:animate-none" style={{ backdropFilter: "none" }} />
        <BaseDialog.Popup
          initialFocus={false}
          className="fixed top-1/2 left-1/2 z-50 h-[207.5px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none"
        >
          <div className="absolute top-6 left-6 flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[inset_0_0_0_1px_var(--danger-edge),0_1px_0_rgb(255_255_255/35%),0_2px_6px_rgb(0_0_0/14%)]">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <line
                x1="7"
                y1="1.2"
                x2="7"
                y2="8.2"
                stroke="var(--background)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="7" cy="11.4" r="1.3" fill="var(--background)" />
            </svg>
          </div>
          <DialogClose className="absolute top-0 left-[324px] flex size-7 items-center justify-center rounded-md text-muted-foreground">
            <svg width="10" height="10" viewBox="9 9 10 10" aria-hidden="true">
              <path
                d="M9 9 L19 19 M19 9 L9 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="px-6 pt-20">
            <DialogTitle className="text-[length:var(--type-section)] leading-[22px] font-semibold text-foreground">
              Delete 3 decks for good?
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[length:var(--type-dense)] leading-[19.5px] text-muted-foreground">
              This can't be undone.
            </DialogDescription>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-0 bg-background px-4 text-sm font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 border-0 bg-destructive px-4 text-sm font-medium text-white shadow-[inset_0_0_0_1px_var(--danger-edge)] hover:bg-destructive"
              >
                Delete for good
              </Button>
            </div>
          </div>
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}

export function TrashList({ confirm = false }: { confirm?: boolean }) {
  return (
    <DeckBrowser
      title="Trash"
      active="trash"
      trailing={
        <button
          type="button"
          className="h-9 rounded-lg bg-background px-3.5 text-sm font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)]"
        >
          Empty Trash
        </button>
      }
    >
      <p className="mt-6 text-sm leading-[18px] text-faint">Decks here are removed for good after 30 days.</p>
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
