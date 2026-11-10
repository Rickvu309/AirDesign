import { readCommit, readDeckId, readWatch, type DeckId, type WireEdit } from "@airdesign/catalog"
import { decide, openRegister, type Register } from "@airdesign/document"

export type OpenResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number; readonly register: Register }
  | { ok: false; readonly refusal: "field" | "deck" | "session" }

export type CommitRefusal =
  | "field"
  | "deck"
  | "batch"
  | "payload"
  | "stale"
  | "person-protected"
  | "run-fenced"
  | "dead"
  | "present"
  | "limit"
  | "session"

export type CommitResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number; readonly key: string }
  | { ok: false; readonly refusal: CommitRefusal }

export type WatchResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number }
  | { ok: false; readonly refusal: "field" | "deck" | "cursor" | "session" }

export type Remote = {
  open(body: { readonly deck: string }): Promise<OpenResult>
  commit(body: { readonly deck: string; readonly batch: readonly WireEdit[] }): Promise<CommitResult>
  watch(body: { readonly deck: string; readonly cursor: number | null }): Promise<WatchResult>
}

type StoredDeck = { readonly revision: number; readonly register: Register }

type Waiter = { readonly cursor: number | null; readonly resolve: (revision: number) => void }

const openPath = "/decks/open"
const commitPath = "/decks/commit"
const watchPath = "/decks/watch"

function readOpen(raw: unknown): { ok: true; deck: DeckId } | { ok: false; refusal: "field" | "deck" } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, refusal: "field" }
  const body = raw as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (key !== "deck") return { ok: false, refusal: "field" }
  }
  if (!Object.hasOwn(body, "deck")) return { ok: false, refusal: "field" }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return { ok: false, refusal: "deck" }
  return { ok: true, deck: deck.deck }
}

function readyRevision(stored: StoredDeck | undefined, cursor: number | null): number | undefined {
  if (stored === undefined) return undefined
  if (cursor === null) return stored.revision
  if (stored.revision > cursor) return stored.revision
  return undefined
}

export function memoryRemote(): Remote {
  const decks = new Map<string, StoredDeck>()
  const waiters = new Map<string, Waiter[]>()

  function notify(deck: string) {
    const stored = decks.get(deck)
    const waiting = waiters.get(deck) ?? []
    const stay: Waiter[] = []
    for (const waiter of waiting) {
      const revision = readyRevision(stored, waiter.cursor)
      if (revision === undefined) stay.push(waiter)
      else waiter.resolve(revision)
    }
    waiters.set(deck, stay)
  }

  return {
    async open(body) {
      const parsed = readOpen(body)
      if (!parsed.ok) return parsed
      const stored = decks.get(parsed.deck)
      if (stored === undefined) {
        const register = openRegister("", parsed.deck)
        decks.set(parsed.deck, { revision: 0, register })
        notify(parsed.deck)
        return { ok: true, deck: parsed.deck, revision: 0, register }
      }
      return { ok: true, deck: parsed.deck, revision: stored.revision, register: stored.register }
    },
    async commit(body) {
      const parsed = readCommit(body)
      if (!parsed.ok) return { ok: false, refusal: parsed.refusal }
      const stored = decks.get(parsed.deck)
      let register = stored?.register ?? openRegister("", parsed.deck)
      for (const edit of parsed.batch) {
        const decision = decide(
          register,
          edit.node === undefined
            ? { command: "person", value: edit.value }
            : { command: "person", value: edit.value, node: edit.node },
        )
        if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
        register = decision.register
      }
      const revision = (stored?.revision ?? 0) + 1
      decks.set(parsed.deck, { revision, register })
      notify(parsed.deck)
      return { ok: true, deck: parsed.deck, revision, key: `${parsed.deck}:${revision}` }
    },
    watch(body) {
      const parsed = readWatch(body)
      if (!parsed.ok) return Promise.resolve({ ok: false, refusal: parsed.refusal })
      const revision = readyRevision(decks.get(parsed.deck), parsed.cursor)
      if (revision !== undefined) return Promise.resolve({ ok: true, deck: parsed.deck, revision })
      return new Promise((resolve) => {
        const waiting = waiters.get(parsed.deck) ?? []
        waiting.push({
          cursor: parsed.cursor,
          resolve: (next) => resolve({ ok: true, deck: parsed.deck, revision: next }),
        })
        waiters.set(parsed.deck, waiting)
      })
    },
  }
}

async function post(path: typeof openPath | typeof commitPath | typeof watchPath, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (response.status === 401) return { ok: false, refusal: "session" }
  return response.json()
}

export function httpRemote(): Remote {
  return {
    open: (body) => post(openPath, body) as Promise<OpenResult>,
    commit: (body) => post(commitPath, body) as Promise<CommitResult>,
    watch: (body) => post(watchPath, body) as Promise<WatchResult>,
  }
}
