import { post, answered } from "@/decks/deck-request"
import {
  pageToastOptions,
  PageToaster,
  settle,
  showFailed,
  showStatus,
  type ToastId,
} from "@/components/ui/page-notice"
import { moveDeck } from "@/decks/move-deck"
import { deckRoutes } from "@airdesign/catalog"
import { dropDeck, sendQueued, starDeck } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  decksFoundOf,
  noMatchTitleOf,
  productCopy,
  restoreFailedOf,
  restoredOf,
  restoringOf,
  starredOf,
  unstarredOf,
} from "@/copy/product-copy"
import { DeckBrowser } from "@/decks/deck-browser"
import { discardOpening } from "@/decks/discard-opening"
import { openingDeck } from "@/lib/first-request"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { clearGridShift, gridShift } from "@/decks/grid-shift"
import { DeckActions, DeckRowMenu } from "@/decks/deck-menu"
import { DeckRow, DeckTableHeader } from "@/decks/deck-row"
import { DeckThumbnail } from "@/decks/deck-thumbnail"
import { MovedToast } from "@/decks/screens/deck-moved-toast"
import { EmptyTrashButton, EmptyTrashDialog, RestoreButton, TrashNote } from "@/decks/screens/trash-list"
import { deckTime } from "@/copy/deck-time-copy"
import { addressOf, addressRead } from "@/decks/deck-address"
import { allDecks, deckPath, decksMatching, recentDecks, type ListedDeck } from "@/decks/deck-listing"
import { signOut } from "@/account/sign-out"

type Deck = ListedDeck & { readonly doom: { readonly rev: number } }
type Listing = { ok: true; account: { email: string }; decks: Deck[]; trash: Deck[] }

async function withDevice(listing: Listing): Promise<Listing> {
  const listed = [...listing.decks, ...listing.trash].map((deck) => deck.deck)
  const stars = await sendQueued(listed).catch(() => new Map<string, boolean>())
  const shown = (decks: Deck[]) =>
    decks.map((deck) => ({ ...deck, starred: stars.get(deck.deck) ?? deck.starred === true }))
  return { ...listing, decks: shown(listing.decks), trash: shown(listing.trash) }
}

function starredIn(listing: Listing, deck: string, starred: boolean): Listing {
  const shown = (decks: Deck[]) => decks.map((each) => (each.deck === deck ? { ...each, starred } : each))
  return { ...listing, decks: shown(listing.decks), trash: shown(listing.trash) }
}

function DeckGridSkeleton({ className }: { className?: string }) {
  return (
    <DeckGrid className={className} data-loading="true" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <article key={key} className="rounded-[var(--shape-dialog)] bg-canvas p-1.5" aria-hidden="true">
          <div className="space-y-2 px-2.5 pt-2 pb-2.5">
            <Skeleton className="h-4 w-3/5 bg-line" />
            <Skeleton className="h-3.5 w-2/5 bg-line" />
          </div>
          <Skeleton className="h-[150px] w-full rounded-[var(--shape-card)] bg-line" />
        </article>
      ))}
    </DeckGrid>
  )
}

function DeckTableSkeleton() {
  return (
    <div className="mt-12 space-y-3" data-loading="true" aria-busy="true">
      <DeckTableHeader sortMarks={false} />
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex h-12 items-center justify-between rounded-lg bg-canvas px-4" aria-hidden="true">
          <Skeleton className="h-4 w-1/3 bg-line" />
          <Skeleton className="h-4 w-24 bg-line" />
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
  const [deleting, setDeleting] = useState<Deck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [said, setSaid] = useState("")
  const result = useRef("")
  const listFailed = useRef(false)
  const [query, setQuery] = useState(() => addressRead(window.location.search).query)
  const [typed, setTyped] = useState<string | null>(() => (query.trim() === "" ? null : query))
  const listView = addressRead(window.location.search).list
  const grid = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const clear = () => clearGridShift(grid.current)
    reduce.addEventListener("change", clear)
    return () => {
      reduce.removeEventListener("change", clear)
      clear()
    }
  }, [query, listView, section])

  async function refresh(shiftAt?: string) {
    try {
      const result = await post(deckRoutes.list.path, {})
      if (result.ok) {
        const noted = openingDeck()
        if (noted !== undefined) await discardOpening(noted)
        const visible =
          noted === undefined
            ? result
            : {
                ...result,
                decks: result.decks.filter((deck: Deck) => deck.deck !== noted),
                trash: result.trash.filter((deck: Deck) => deck.deck !== noted),
              }
        const next = await withDevice(visible)
        const change = () => setListing(next)
        if (shiftAt === window.location.href && (!listView || trash)) gridShift(() => grid.current, change)
        else {
          clearGridShift(grid.current)
          change()
        }
        setUnavailable(false)
      } else if (result.refusal !== "session") setUnavailable(true)
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
    setSaid("")
    setQuery(next)
    setTyped(next)
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

  async function restore(deck: Deck, pointer = false, moved?: ToastId) {
    const shiftAt = pointer ? window.location.href : undefined
    const held = onDeck() || document.activeElement?.closest("[data-sonner-toast]") != null
    const key = `restore-${deck.deck}`
    if (moved === undefined) settle(key)
    const pending = showStatus(restoringOf(deck.name), moved)
    const ok = await answered(deckRoutes.restore.path, { deck: deck.deck })
    if (!ok) {
      showFailed(key, restoreFailedOf(deck.name), () => void restore(deck), pending)
      return
    }
    showStatus(restoredOf(deck.name), pending, 4000)
    await refresh(shiftAt)
    if (held) keepFocus()
  }

  async function move(deck: Deck, held = onDeck(), pointer = false) {
    const shiftAt = pointer ? window.location.href : undefined
    await moveDeck(deck, async (pending) => {
      await refresh(shiftAt)
      if (held) keepFocus()
      toast.notice((id) => <MovedToast name={deck.name} onUndo={(pointer) => void restore(deck, pointer, id)} />, {
        ...pageToastOptions,
        id: pending,
      })
    })
  }

  function star(deck: Deck) {
    const starred = deck.starred !== true
    setListing((shown) => shown && starredIn(shown, deck.deck, starred))
    setSaid(starred ? starredOf(deck.name) : unstarredOf(deck.name))
    void starDeck(deck.deck, starred).catch(() => undefined)
  }

  const loading = listing === null && !unavailable
  const held = (trash ? listing?.trash : listing?.decks) ?? []
  const searching = query.trim() !== ""
  const ordered = trash ? held : section === "recents" && !searching ? recentDecks(held) : allDecks(held)
  const decks = decksMatching(ordered, query)
  const noMatch = listing !== null && searching && held.length > 0 && decks.length === 0
  const firstVisit = listing !== null && section === "recents" && held.length === 0 && listing.trash.length === 0
  const noDecks = listing !== null && !trash && held.length === 0
  const showGrid = !listView || trash
  result.current = noDecks
    ? productCopy.noDecksTitle
    : noMatch
      ? noMatchTitleOf(query.trim())
      : decksFoundOf(decks.length)
  const loaded = listing !== null
  useEffect(() => {
    if (typed === null || typed.trim() === "" || !loaded || unavailable) return
    const timer = window.setTimeout(() => setSaid(result.current), 300)
    return () => window.clearTimeout(timer)
  }, [typed, loaded, unavailable])
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
      starred={listing?.decks.filter((deck) => deck.starred === true)}
      newDeck={{ onBlank: () => navigate("/s") }}
      onSignOut={() => void signOut()}
      onNavigate={navigate}
      trailing={
        trash ? <EmptyTrashButton disabled={decks.length === 0} onClick={() => setDeleting([...decks])} /> : undefined
      }
    >
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
      {loading && (!listView || trash) && <DeckGridSkeleton className={trash ? "mt-6 grid-cols-3" : undefined} />}
      {loading && listView && !trash && <DeckTableSkeleton />}
      {noDecks && (
        <div className="mt-8">
          <Card className="w-full" title={productCopy.noDecksTitle} description={productCopy.noDecksBody} />
        </div>
      )}
      {listing !== null && showGrid && !noDecks && !noMatch && (
        <DeckGrid ref={grid} className={trash ? "mt-6 grid-cols-3" : section !== "recents" ? "mt-6" : undefined}>
          {!listView || trash
            ? decks.map((deck) => (
                <DeckCard
                  key={deck.deck}
                  deck={deck.deck}
                  name={deck.name}
                  edited={
                    trash ? deckTime(deck.trashed ?? deck.edited, now()).trash : deckTime(deck.edited, now()).card
                  }
                  href={trash ? undefined : deckPath(deck)}
                  previewClassName={section !== "recents" ? "h-[136px]" : undefined}
                  preview={<DeckThumbnail deck={deck.deck} rev={deck.doom.rev} name={deck.name} />}
                  action={
                    trash ? (
                      <RestoreButton onClick={(pointer) => void restore(deck, pointer)} />
                    ) : (
                      <DeckActions
                        name={deck.name}
                        starred={deck.starred === true}
                        onStar={() => star(deck)}
                        onTrash={(pointer) => void move(deck, true, pointer)}
                      />
                    )
                  }
                />
              ))
            : null}
        </DeckGrid>
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
      {listView && !trash && listing !== null && !noDecks && !noMatch && (
        <div className="mt-12">
          <DeckTableHeader sortMarks={false} />
          {decks.map((deck) => (
            <DeckRowMenu
              key={deck.deck}
              name={deck.name}
              starred={deck.starred === true}
              onStar={() => star(deck)}
              onTrash={(pointer) => void move(deck, true, pointer)}
            >
              <DeckRow
                name={deck.name}
                edited={deckTime(deck.edited, now()).row}
                created={deckTime(deck.created, now()).created}
                href={deckPath(deck)}
              />
            </DeckRowMenu>
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
              className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text"
            >
              {productCopy.deleteFailed}
            </p>
          ) : null}
        </EmptyTrashDialog>
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
      <PageToaster />
    </DeckBrowser>
  )
}
