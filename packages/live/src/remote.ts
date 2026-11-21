import {
  deckRoutes,
  readCapture,
  readCommit,
  readWatch,
  readDeckIndex,
  type DeckId,
  type WireRefusal,
  slideEditCommand,
  type WireEdit,
  type WireSlide,
  type OpenResult,
  type CommitResult,
  type WatchResult,
  type FindingsReport,
} from "@airdesign/catalog"
import {
  answeredRegister,
  indexedSectionStarts,
  appendIndex,
  bytesOf,
  decide,
  limits,
  openRegister,
  storedValue,
  type IndexPage,
  type Register,
  type SlideId,
} from "@airdesign/document"

export type { OpenResult, CommitResult, WatchResult } from "@airdesign/catalog"

export type Remote = {
  index?(
    body: IndexPage & { readonly deck: string },
  ): Promise<
    | { readonly ok: true; readonly deck: DeckId; readonly revision: number }
    | { readonly ok: false; readonly refusal: WireRefusal }
  >
  open(body: { readonly deck: string }): Promise<OpenResult>
  commit(body: {
    readonly deck: string
    readonly batch: readonly (WireEdit | WireSlide)[]
    readonly once?: string
  }): Promise<CommitResult>
  watch(body: { readonly deck: string; readonly cursor: number | null }): Promise<WatchResult>
  findings?(
    body: FindingsReport,
  ): Promise<
    | { readonly ok: true; readonly deck: DeckId; readonly missing?: readonly SlideId[] }
    | { readonly ok: false; readonly refusal: WireRefusal }
  >
}

type StoredDeck = { readonly revision: number; readonly register: Register }

type Waiter = { readonly cursor: number | null; readonly resolve: (revision: number) => void }

function readyRevision(stored: StoredDeck | undefined, cursor: number | null): number | undefined {
  if (stored === undefined) return undefined
  if (cursor === null) return stored.revision
  if (stored.revision > cursor) return stored.revision
  return undefined
}

export function memoryRemote(): Remote {
  const decks = new Map<string, StoredDeck>()
  const waiters = new Map<string, Waiter[]>()
  const spent = new Map<string, CommitResult>()

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
    async index(body) {
      const parsed = readDeckIndex(body)
      if (!parsed.ok) return parsed
      const stored = decks.get(parsed.deck)
      if (stored === undefined) return { ok: false, refusal: "deck" }
      const { ok: _ok, deck: id, ...page } = parsed
      const next = appendIndex(stored.register.index, page)
      if (!next.ok) return next
      const introduced =
        stored.register.index !== undefined &&
        stored.register.index.sectionStarts === undefined &&
        indexedSectionStarts(next.index) !== undefined
      const revision = stored.revision + Number(introduced)
      decks.set(id, { revision, register: { ...stored.register, index: next.index } })
      if (introduced) notify(id)
      return { ok: true, deck: id, revision }
    },
    async open(body) {
      const parsed = readCapture(body)
      if (!parsed.ok) return parsed
      const stored = decks.get(parsed.deck)
      if (stored === undefined) {
        const register = openRegister("", parsed.deck)
        decks.set(parsed.deck, { revision: 0, register })
        notify(parsed.deck)
        return { ok: true, deck: parsed.deck, revision: 0, register }
      }
      return { ok: true, deck: parsed.deck, revision: stored.revision, register: answeredRegister(stored.register) }
    },
    async commit(body) {
      if (bytesOf(JSON.stringify(body)) > limits.body) return { ok: false, refusal: "size" }
      const parsed = readCommit(body)
      if (!parsed.ok) return { ok: false, refusal: parsed.refusal }
      const stored = decks.get(parsed.deck)
      if (stored === undefined) return { ok: false, refusal: "deck" }
      const once = parsed.once === undefined ? undefined : `${parsed.deck}\u0000${parsed.once}`
      const prior = once === undefined ? undefined : spent.get(once)
      if (prior !== undefined) return prior
      let register = stored.register
      for (const edit of parsed.batch) {
        if ("slide" in edit) {
          const decision = decide(register, { command: "slide", file: edit.file, edit: slideEditCommand(edit) })
          if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
          register = decision.register
          continue
        }
        if (!register.nodes.includes(edit.node)) {
          const opened = decide(register, {
            command: "add",
            node: edit.node,
            floor: edit.floor ?? register.floor,
            route: register.route,
          })
          if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
          register = opened.register
        }
        const decision = decide(register, { command: "person", ...storedValue(edit), node: edit.node })
        if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
        register = decision.register
      }
      const revision = stored.revision + 1
      decks.set(parsed.deck, { revision, register })
      const landed = { ok: true, deck: parsed.deck, revision, key: `${parsed.deck}:${revision}` } as const
      if (once !== undefined) spent.set(once, landed)
      notify(parsed.deck)
      return landed
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

export function ownerRemote(): Remote {
  const refused = { ok: false as const, refusal: "owner" as const }
  return {
    index: () => Promise.resolve(refused),
    open: () => Promise.resolve(refused),
    commit: () => Promise.resolve(refused),
    watch: () => Promise.resolve(refused),
  }
}

export async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (response.status === 401) return { ok: false, refusal: "session" }
  if (response.status >= 500) throw new TypeError(`AirDesign did not answer: ${String(response.status)}`)
  const answer: unknown = await response.json().catch(() => undefined)
  if (answer !== undefined) return answer
  if (response.ok) throw new TypeError(`AirDesign's answer was cut off: ${String(response.status)}`)
  return null
}

export function httpRemote(): Remote {
  return {
    index: async (body) => deckRoutes.index.result(await post(deckRoutes.index.path, body)),
    open: async (body) => deckRoutes.open.result(await post(deckRoutes.open.path, body)),
    commit: async (body) => deckRoutes.commit.result(await post(deckRoutes.commit.path, body)),
    watch: async (body) => deckRoutes.watch.result(await post(deckRoutes.watch.path, body)),
    findings: async (body) => deckRoutes.findings.result(await post(deckRoutes.findings.path, body)),
  }
}
