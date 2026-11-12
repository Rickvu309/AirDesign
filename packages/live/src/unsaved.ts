import { limits, readBox, type Box, type SlideCommand, type SlideId } from "@airdesign/document"

export type Shelf = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

export type Unsaved =
  | {
      readonly kind: "text"
      readonly id: string
      readonly node: string
      readonly floor: string
      readonly value: string
    }
  | { readonly kind: "box"; readonly id: string; readonly node: string; readonly floor: string; readonly box: Box }
  | {
      readonly kind: "slide"
      readonly id: string
      readonly file: readonly SlideId[]
      readonly edit: SlideCommand
    }

type Without<Entry> = Entry extends Unsaved ? Omit<Entry, "id"> : never

export type Kept = Without<Unsaved>

const shelfPrefix = "airdesign:unsaved:"
const shelfKey = (account: string, deck: string) => `${shelfPrefix}${account}:${deck}`
const legacyKey = (deck: string) => `${shelfPrefix}${deck}`

export function pageShelf(): Shelf | undefined {
  try {
    return "window" in globalThis ? globalThis.localStorage : undefined
  } catch {
    return undefined
  }
}

function slotOf(entry: Kept): string | null {
  return entry.kind === "slide" ? null : `${entry.kind}:${entry.node}`
}

function isEntry(raw: unknown): raw is Unsaved {
  if (typeof raw !== "object" || raw === null) return false
  const entry = raw as Record<string, unknown>
  if (typeof entry.id !== "string") return false
  if (entry.kind === "slide") return Array.isArray(entry.file) && typeof entry.edit === "object" && entry.edit !== null
  if (typeof entry.node !== "string" || typeof entry.floor !== "string") return false
  if (entry.kind === "text") return typeof entry.value === "string"
  return entry.kind === "box" && readBox(entry.box) !== null
}

function entriesAt(shelf: Shelf | undefined, key: string): Unsaved[] {
  if (shelf === undefined) return []
  try {
    const raw = shelf.getItem(key)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export function unsavedOf(shelf: Shelf | undefined, account: string, deck: string): Unsaved[] {
  return entriesAt(shelf, shelfKey(account, deck))
}

function write(shelf: Shelf, account: string, deck: string, entries: readonly Unsaved[]): void {
  try {
    if (entries.length === 0) shelf.removeItem(shelfKey(account, deck))
    else shelf.setItem(shelfKey(account, deck), JSON.stringify(entries))
  } catch {
    return
  }
}

function shelfKeys(shelf: Shelf | undefined): string[] {
  if (shelf === undefined) return []
  try {
    const keys: string[] = []
    for (let at = 0; at < shelf.length; at += 1) {
      const key = shelf.key(at)
      if (key?.startsWith(shelfPrefix) === true) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

export function journalDecks(shelf: Shelf | undefined, account: string): string[] {
  const prefix = shelfKey(account, "")
  return shelfKeys(shelf)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
}

export function dropJournal(shelf: Shelf | undefined, account: string, deck?: string): void {
  if (shelf === undefined) return
  const decks = deck === undefined ? journalDecks(shelf, account) : [deck]
  for (const each of decks) write(shelf, account, each, [])
}

export function hasLegacyJournal(shelf: Shelf | undefined, deck: string): boolean {
  return entriesAt(shelf, legacyKey(deck)).length > 0
}

export function adoptJournal(shelf: Shelf | undefined, account: string, deck: string): void {
  if (shelf === undefined) return
  const legacy = entriesAt(shelf, legacyKey(deck))
  if (legacy.length === 0) return
  if (unsavedOf(shelf, account, deck).length === 0) write(shelf, account, deck, legacy)
  try {
    shelf.removeItem(legacyKey(deck))
  } catch {
    return
  }
}

export function keepUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string, entry: Kept): void {
  if (shelf === undefined) return
  const slot = slotOf(entry)
  const next: Unsaved = { ...entry, id }
  if (JSON.stringify(next).length > limits.row) return
  const kept = unsavedOf(shelf, account, deck).filter((held) => slot === null || slotOf(held) !== slot)
  write(shelf, account, deck, [...kept, next])
}

export function releaseUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string): void {
  if (shelf === undefined) return
  const held = unsavedOf(shelf, account, deck)
  const rest = held.filter((entry) => entry.id !== id)
  if (rest.length !== held.length) write(shelf, account, deck, rest)
}

export function holdsUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string): boolean {
  return unsavedOf(shelf, account, deck).some((entry) => entry.id === id)
}

const recovering = new WeakMap<Shelf, Map<string, Promise<void>>>()

export function recoverUnsaved(
  shelf: Shelf | undefined,
  account: string,
  deck: string,
  replay: (entry: Unsaved) => Promise<unknown>,
): Promise<void> {
  if (shelf === undefined) return Promise.resolve()
  const decks = recovering.get(shelf) ?? new Map<string, Promise<void>>()
  recovering.set(shelf, decks)
  const lane = shelfKey(account, deck)
  const known = decks.get(lane)
  if (known !== undefined) return known
  const entries = unsavedOf(shelf, account, deck)
  const done = (async () => {
    for (const entry of entries) {
      try {
        await replay(entry)
      } catch {
        return
      }
      releaseUnsaved(shelf, account, deck, entry.id)
    }
  })()
  decks.set(lane, done)
  return done
}
