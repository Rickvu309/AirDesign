import { deckRoutes, signOutRoutes } from "@airdesign/catalog"
import { connect, dropDeck, memoryRemote, sendQueuedNames } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { noMatchTitleOf, productCopy } from "@/copy/product-copy"
import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { DeckRow, DeckTableHeader } from "@/decks/deck-row"
import { ImportingPreview, ImportFailedPreview } from "@/decks/deck-status-preview"
import { importFailureWords, type ImportFailureReason } from "@/copy/import-failure-words"
import { NewDeckMenu } from "@/decks/new-deck-menu"
import { blankDeck } from "@/decks/blank-deck"
import { MovedToast, MovedToaster, movedToastOptions } from "@/decks/screens/deck-moved-toast"
import { EmptyTrashButton, EmptyTrashDialog, RestoreButton, TrashNote } from "@/decks/screens/trash-list"
import { deckTime } from "@/decks/deck-time"
import { addressOf, addressRead } from "@/decks/deck-address"
import { allDecks, decksMatching, recentDecks, type ListedDeck } from "@/decks/deck-listing"
import { importDeck } from "@/import-deck"
import { signInAddress } from "@/thin-notice"

type Deck = ListedDeck
type Listing = { ok: true; account: { email: string }; decks: Deck[]; trash: Deck[] }
type Importing = { name: string; failed: false } | { name: string; failed: true; reason: ImportFailureReason }

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

async function withQueuedNames(listing: Listing): Promise<Listing> {
  const queued = await sendQueuedNames([...listing.decks, ...listing.trash].map((deck) => deck.deck)).catch(
    () => new Map<string, string>(),
  )
  const named = (decks: Deck[]) => decks.map((deck) => ({ ...deck, name: queued.get(deck.deck) ?? deck.name }))
  return { ...listing, decks: named(listing.decks), trash: named(listing.trash) }
}

async function signOut(): Promise<void> {
  const response = await fetch(signOutRoutes.session.path, { method: signOutRoutes.session.method })
  if (response.ok) window.location.assign(signInAddress(window.location))
}

function DeckGridSkeleton({ className }: { className?: string }) {
  return (
    <DeckGrid className={className} data-loading="true" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <article key={key} className="rounded-[var(--shape-dialog)] bg-background p-1.5" aria-hidden="true">
          <div className="space-y-2 px-2.5 pt-2 pb-2.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-[var(--shape-card)]" />
        </article>
      ))}
    </DeckGrid>
  )
}

function DeckTableSkeleton() {
  return (
    <div className="mt-8 space-y-3" data-loading="true" aria-busy="true">
      <DeckTableHeader />
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex h-12 items-center justify-between rounded-lg bg-background px-4"
          aria-hidden="true"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

export type HomeSection = "recents" | "all-decks" | "trash"

const sectionPaths: Record<HomeSection, string> = { recents: "/", "all-decks": "/all", trash: "/trash" }

const sectionTitles: Record<HomeSection, string> = { recents: "Recents", "all-decks": "All decks", trash: "Trash" }

export function homeSection(path: string): HomeSection {
  return path === "/trash" ? "trash" : path === "/all" ? "all-decks" : "recents"
}

export function Home({
  section = "recents",
  now = Date.now,
  navigate,
}: {
  section?: HomeSection
  now?: () => number
  navigate: (path: string) => void
}) {
  const trash = section === "trash"
  const [listing, setListing] = useState<Listing | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [menu, setMenu] = useState(false)
  const [deleting, setDeleting] = useState<Deck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [importing, setImporting] = useState<Importing | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const listFailed = useRef(false)
  const [query, setQuery] = useState(() => addressRead(window.location.search).query)
  const listView = addressRead(window.location.search).list
  async function refresh() {
    try {
      const result = await post(deckRoutes.list.path, {})
      if (result.ok) {
        setListing(await withQueuedNames(result))
        setUnavailable(false)
      } else if (result.refusal !== "session") setUnavailable(true)
    } catch {
      setUnavailable(true)
    }
  }
  useEffect(() => {
    void refresh().then(() => connect(memoryRemote()).sweep().catch(() => undefined))
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])
  useEffect(() => {
    if (unavailable) {
      listFailed.current = true
      return
    }
    if (!listFailed.current) return
    listFailed.current = false
    if (document.activeElement !== document.body) return
    const heading = document.querySelector("h1")
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1
      heading.focus()
    }
  }, [unavailable])

  function search(next: string) {
    setQuery(next)
    window.history.replaceState(null, "", addressOf(window.location.pathname, { list: listView, query: next }))
  }

  function onDeck(): boolean {
    return document.activeElement?.closest("[data-decks-main] article") != null
  }

  function keepFocus() {
    const heading = document.querySelector("h1")
    if (!(heading instanceof HTMLElement)) return
    heading.tabIndex = -1
    heading.focus()
  }

  async function restore(deck: Deck) {
    const held = onDeck()
    if ((await post(deckRoutes.restore.path, { deck: deck.deck })).ok) {
      await refresh()
      if (held) keepFocus()
    }
  }

  async function move(deck: Deck) {
    const held = onDeck()
    if (!(await post(deckRoutes.trash.path, { deck: deck.deck })).ok) return
    await refresh()
    if (held) keepFocus()
    toast.custom(
      (id) => (
        <MovedToast
          name={deck.name}
          onUndo={() => {
            void restore(deck).then(() => toast.dismiss(id))
          }}
        />
      ),
      { ...movedToastOptions, duration: 9_000 },
    )
  }

  async function choose(file: File) {
    setMenu(false)
    setImporting({ name: file.name, failed: false })
    try {
      const imported = await importDeck(file)
      if (!imported.ok) {
        setImporting({ name: file.name, failed: true, reason: imported.reason })
        return
      }
      navigate(`/deck/${imported.deck.id}`)
    } catch {
      setImporting({ name: file.name, failed: true, reason: "save" })
    }
  }

  const loading = listing === null && !unavailable
  const held = (trash ? listing?.trash : listing?.decks) ?? []
  const searching = query.trim() !== ""
  const ordered = trash ? held : section === "recents" && !searching ? recentDecks(held) : allDecks(held)
  const decks = decksMatching(ordered, query)
  const noMatch = listing !== null && searching && held.length > 0 && decks.length === 0
  const firstVisit =
    listing !== null && section === "recents" && held.length === 0 && listing.trash.length === 0 && importing === null
  const noDecks = listing !== null && !trash && held.length === 0 && importing === null
  return (
    <DeckBrowser
      title={sectionTitles[section]}
      active={section}
      account={listing?.account ?? { email: "" }}
      firstVisit={firstVisit}
      view={listView ? "list" : "grid"}
      links={{
        grid: addressOf(sectionPaths[section], { list: false, query }),
        list: addressOf(sectionPaths[section], { list: true, query }),
      }}
      search={{ value: query, onChange: search }}
      menu={
        menu && <NewDeckMenu onImport={() => picker.current?.click()} onBlank={() => void blankDeck().then(choose)} />
      }
      menuOpen={menu}
      onNewDeck={() => setMenu(!menu)}
      onSignOut={() => void signOut()}
      onNavigate={navigate}
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
      {unavailable && (
        <div className="mt-8" role="alert">
          <Card
            className="w-full"
            title={productCopy.decksFailedTitle}
            description={productCopy.decksFailedBody}
            actions={
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                {productCopy.payTryAgain}
              </Button>
            }
          />
        </div>
      )}
      {loading && (!listView || trash) && <DeckGridSkeleton className={trash ? "mt-6" : undefined} />}
      {loading && listView && !trash && <DeckTableSkeleton />}
      {noDecks && (
        <div className="mt-8">
          <Card
            className="w-full"
            title={productCopy.noDecksTitle}
            description={productCopy.noDecksBody}
            actions={
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void blankDeck().then(choose)}>
                  {productCopy.blankDeck}
                </Button>
                <Button variant="outline" size="sm" onClick={() => picker.current?.click()}>
                  {productCopy.importPowerPoint}
                </Button>
              </div>
            }
          />
        </div>
      )}
      {noMatch && (
        <div className="mt-8">
          <Card
            className="w-full"
            title={noMatchTitleOf(query.trim())}
            description={productCopy.noMatchBody}
            actions={
              <Button variant="outline" size="sm" onClick={() => search("")}>
                {productCopy.clearSearch}
              </Button>
            }
          />
        </div>
      )}
      {(listing !== null || importing !== null) && !noDecks && !noMatch && (
        <DeckGrid className={trash ? "mt-6" : undefined}>
          {importing &&
            (importing.failed ? (
              <div role="alert">
                <DeckCard
                  name={importing.name}
                  edited={importFailureWords(importing.reason).title}
                  editedClassName="text-danger-text"
                  previewClassName="bg-background"
                  preview={
                    <ImportFailedPreview
                      detail={importFailureWords(importing.reason).detail}
                      focusChoose
                      onChoose={() => picker.current?.click()}
                      onRemove={() => setImporting(null)}
                    />
                  }
                />
              </div>
            ) : (
              <DeckCard name={importing.name} edited={productCopy.importing} preview={<ImportingPreview />} />
            ))}
          {!listView || trash
            ? decks.map((deck) => (
                <DeckCard
                  key={deck.deck}
                  name={deck.name}
                  edited={
                    trash ? deckTime(deck.trashed ?? deck.edited, now()).trash : deckTime(deck.edited, now()).card
                  }
                  href={`/deck/${deck.deck}`}
                  previewClassName={trash ? "h-[180px]" : undefined}
                  action={
                    trash ? (
                      <RestoreButton onClick={() => void restore(deck)} />
                    ) : (
                      <Button variant="outline" size="sm" aria-description={deck.name} onClick={() => void move(deck)}>
                        {productCopy.moveToTrash}
                      </Button>
                    )
                  }
                />
              ))
            : null}
        </DeckGrid>
      )}
      {listView && !trash && listing !== null && !noDecks && !noMatch && (
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
                <Button variant="ghost" size="sm" aria-description={deck.name} onClick={() => void move(deck)}>
                  {productCopy.moveToTrash}
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
            if (busy) return
            setDeleting(null)
            setDeleteFailed(false)
          }}
          onConfirm={() => {
            setBusy(true)
            setDeleteFailed(false)
            void post(deckRoutes.delete.path, { decks: deleting.map((deck) => deck.deck) })
              .catch(() => ({ ok: false }))
              .then(async (result) => {
                if (!result.ok) {
                  setDeleteFailed(true)
                  return
                }
                await Promise.all(deleting.map((deck) => dropDeck(deck.deck).catch(() => undefined)))
                setDeleting(null)
                await refresh()
              })
              .finally(() => setBusy(false))
          }}
        >
          {deleteFailed ? (
            <p
              role="alert"
              className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-destructive"
            >
              {productCopy.deleteFailed}
            </p>
          ) : null}
        </EmptyTrashDialog>
      )}
      <MovedToaster />
    </DeckBrowser>
  )
}
