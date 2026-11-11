import { deckRoutes } from "@airdesign/catalog"
import { sendOriginal } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { DeckRow, DeckTableHeader } from "@/decks/deck-row"
import { ImportingPreview, ImportFailedPreview } from "@/decks/deck-status-preview"
import { NewDeckMenu } from "@/decks/new-deck-menu"
import { MovedToast, MovedToaster, movedToastOptions } from "@/decks/screens/deck-moved-toast"
import { EmptyTrashButton, EmptyTrashDialog, RestoreButton, TrashNote } from "@/decks/screens/trash-list"
import { starterDeckCards } from "@/decks/sample-decks"
import { deckTime } from "@/decks/deck-time"
import { importDeck, nameImportedDeck } from "@/thin-deck"
import { signInAddress } from "@/thin-notice"

type Deck = { deck: string; name: string; edited: string; created: string; trashed?: string }
type Listing = { ok: true; account: { email: string }; decks: Deck[]; trash: Deck[] }

async function post(path: string, body: object) {
  const response = await fetch(path, {
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
  const [unavailable, setUnavailable] = useState(false)
  const [menu, setMenu] = useState(false)
  const [deleting, setDeleting] = useState<Deck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState<{ name: string; failed: boolean } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const listView = new URLSearchParams(window.location.search).get("view") === "list"
  async function refresh() {
    try {
      const result = await post(deckRoutes.list.path, {})
      if (result.ok) {
        setListing(result)
        setUnavailable(false)
      } else setUnavailable(true)
    } catch {
      setUnavailable(true)
    }
  }
  useEffect(() => {
    void refresh()
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])

  async function restore(deck: Deck) {
    if ((await post(deckRoutes.restore.path, { deck: deck.deck })).ok) await refresh()
  }

  async function move(deck: Deck) {
    if (!(await post(deckRoutes.trash.path, { deck: deck.deck })).ok) return
    await refresh()
    toast.custom(
      (id) => (
        <MovedToast
          name={deck.name}
          onUndo={() => {
            void restore(deck).then(() => toast.dismiss(id))
          }}
        />
      ),
      movedToastOptions,
    )
  }

  async function choose(file: File) {
    setMenu(false)
    setImporting({ name: file.name, failed: false })
    try {
      const imported = await importDeck(file)
      if (imported === null) throw new Error("import-failed")
      await nameImportedDeck(imported.id, file.name)
      await sendOriginal(imported.id, imported.file)
      window.location.assign(`/deck/${imported.id}`)
    } catch {
      setImporting({ name: file.name, failed: true })
    }
  }

  if (listing === null && !unavailable) return null
  const decks = (trash ? listing?.trash : listing?.decks) ?? []
  const firstVisit =
    listing !== null && !trash && decks.length === 0 && listing.trash.length === 0 && importing === null
  return (
    <DeckBrowser
      title={trash ? "Trash" : "Recents"}
      active={trash ? "trash" : "recents"}
      account={listing?.account ?? { email: "" }}
      firstVisit={firstVisit}
      view={listView ? "list" : "grid"}
      home
      menu={menu && <NewDeckMenu onImport={() => picker.current?.click()} />}
      menuOpen={menu}
      onNewDeck={() => setMenu(!menu)}
      trailing={
        trash ? <EmptyTrashButton disabled={decks.length === 0} onClick={() => setDeleting([...decks])} /> : undefined
      }
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
      {trash && <TrashNote />}
      <DeckGrid className={trash ? "mt-6" : undefined}>
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
                previewClassName={trash ? "h-[180px]" : undefined}
                action={
                  trash ? (
                    <RestoreButton onClick={() => void restore(deck)} />
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => void move(deck)}>
                      Move to Trash
                    </Button>
                  )
                }
              />
            ))
          : null}
      </DeckGrid>
      {listView && !trash && (
        <div className="mt-8">
          <DeckTableHeader />
          {decks.map((deck) => (
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
        </div>
      )}
      {deleting && (
        <EmptyTrashDialog
          count={deleting.length}
          busy={busy}
          onCancel={() => {
            if (!busy) setDeleting(null)
          }}
          onConfirm={() => {
            setBusy(true)
            void post(deckRoutes.delete.path, { decks: deleting.map((deck) => deck.deck) })
              .then(async (result) => {
                if (result.ok) {
                  setDeleting(null)
                  await refresh()
                }
              })
              .finally(() => setBusy(false))
          }}
        />
      )}
      <MovedToaster />
    </DeckBrowser>
  )
}
