import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { DeckRow } from "@/decks/deck-row"
import { ImportingPreview, ImportFailedPreview } from "@/decks/deck-status-preview"
import { NewDeckMenu } from "@/decks/new-deck-menu"
import { ViewSwitch } from "@/decks/view-switch"
import { starterDeckCards } from "@/decks/sample-decks"
import { deckTime } from "@/decks/deck-time"
import { importDeck, nameImportedDeck } from "@/thin-deck"
import { signInAddress } from "@/thin-notice"

type Deck = { deck: string; name: string; edited: string; created: string; trashed?: string }
type Listing = { ok: true; account: { email: string }; decks: Deck[]; trash: Deck[] }

async function post(path: string, body: object) {
  const response = await fetch(`/decks/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const answer = await response.json()
  if (response.status === 401 && answer.refusal === "session") window.location.assign(signInAddress(window.location))
  return answer
}

export function Home({ trash = false, now = Date.now }: { trash?: boolean; now?: () => number }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [menu, setMenu] = useState(false)
  const [deleting, setDeleting] = useState<Deck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState<{ name: string; failed: boolean } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const listView = new URLSearchParams(window.location.search).get("view") === "list"
  async function refresh() {
    try {
      const result = await post("list", {})
      if (result.ok) setListing(result)
    } catch {}
  }
  useEffect(() => {
    void refresh()
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])

  async function restore(deck: Deck) {
    if ((await post("restore", { deck: deck.deck })).ok) await refresh()
  }

  async function move(deck: Deck) {
    if (!(await post("trash", { deck: deck.deck })).ok) return
    await refresh()
    toast.custom(
      (id) => (
        <div className="flex h-10 items-center gap-4 rounded-lg bg-foreground px-4 text-sm text-background">
          <span>{deck.name} moved to Trash</span>
          <button
            type="button"
            className="font-medium"
            onClick={() => {
              void restore(deck).then(() => toast.dismiss(id))
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: Infinity },
    )
  }

  async function choose(file: File) {
    setMenu(false)
    setImporting({ name: file.name, failed: false })
    try {
      const imported = await importDeck(file)
      if (imported === null) throw new Error("import-failed")
      await nameImportedDeck(imported.id, file.name)
      window.location.assign(`/deck/${imported.id}`)
    } catch {
      setImporting({ name: file.name, failed: true })
    }
  }

  if (listing === null) return null
  const decks = trash ? listing.trash : listing.decks
  const firstVisit = !trash && decks.length === 0 && importing === null
  const trailing = trash ? (
    <Button variant="outline" disabled={decks.length === 0} onClick={() => setDeleting([...decks])}>
      Empty Trash
    </Button>
  ) : (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Button onClick={() => setMenu(!menu)} aria-expanded={menu}>
          New deck
        </Button>
        {menu && <NewDeckMenu onImport={() => picker.current?.click()} />}
      </div>
      <ViewSwitch active={listView ? "list" : "grid"} home />
    </div>
  )
  return (
    <DeckBrowser
      title={trash ? "Trash" : "Recents"}
      active={trash ? "trash" : "recents"}
      account={listing.account}
      firstVisit={firstVisit}
      trailing={trailing}
    >
      <input
        className="hidden"
        ref={picker}
        type="file"
        accept=".pptx"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file) void choose(file)
        }}
      />
      {trash && <p className="my-6 text-sm text-muted-foreground">Decks here are removed for good after 30 days.</p>}
      <DeckGrid>
        {importing && (
          <DeckCard
            name={importing.name}
            edited={importing.failed ? "Unable to import" : "Importing"}
            preview={
              importing.failed ? (
                <ImportFailedPreview onChoose={() => picker.current?.click()} onRemove={() => setImporting(null)} />
              ) : (
                <ImportingPreview />
              )
            }
          />
        )}
        {firstVisit && starterDeckCards.map((deck) => <DeckCard key={deck.name} {...deck} />)}
        {!listView || trash
          ? decks.map((deck) => (
              <DeckCard
                key={deck.deck}
                name={deck.name}
                edited={trash ? deckTime(deck.trashed ?? deck.edited, now()).trash : deckTime(deck.edited, now()).card}
                href={`/deck/${deck.deck}`}
                action={
                  <Button variant="outline" size="sm" onClick={() => void (trash ? restore(deck) : move(deck))}>
                    {trash ? "Restore" : "Move to Trash"}
                  </Button>
                }
              />
            ))
          : null}
      </DeckGrid>
      {listView &&
        !trash &&
        decks.map((deck) => (
          <DeckRow
            key={deck.deck}
            name={deck.name}
            edited={deckTime(deck.edited, now()).row}
            created={deckTime(deck.created, now()).created}
            href={`/deck/${deck.deck}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => void move(deck)}>
                Move to Trash
              </Button>
            }
          />
        ))}
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogTitle>Delete {deleting?.length} decks for good?</DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (!deleting) return
                setBusy(true)
                void post("delete", { decks: deleting.map((deck) => deck.deck) })
                  .then(async (result) => {
                    if (result.ok) {
                      setDeleting(null)
                      await refresh()
                    }
                  })
                  .finally(() => setBusy(false))
              }}
            >
              Delete for good
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster position="top-center" />
    </DeckBrowser>
  )
}
