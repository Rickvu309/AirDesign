import { limits, readBox, type Box, type SlideCommand, type SlideId } from "@airdesign/document"

export type Shelf = Pick<Storage, "getItem" | "setItem" | "removeItem">

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

const shelfKey = (deck: string) => `airdesign:unsaved:${deck}`

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

export function unsavedOf(shelf: Shelf | undefined, deck: string): Unsaved[] {
  if (shelf === undefined) return []
  try {
    const raw = shelf.getItem(shelfKey(deck))
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

function write(shelf: Shelf, deck: string, entries: readonly Unsaved[]): void {
  try {
    if (entries.length === 0) shelf.removeItem(shelfKey(deck))
    else shelf.setItem(shelfKey(deck), JSON.stringify(entries))
  } catch {
    return
  }
}

export function keepUnsaved(shelf: Shelf | undefined, deck: string, id: string, entry: Kept): void {
  if (shelf === undefined) return
  const slot = slotOf(entry)
  const next: Unsaved = { ...entry, id }
  if (JSON.stringify(next).length > limits.row) return
  const kept = unsavedOf(shelf, deck).filter((held) => slot === null || slotOf(held) !== slot)
  write(shelf, deck, [...kept, next])
}

export function releaseUnsaved(shelf: Shelf | undefined, deck: string, id: string): void {
  if (shelf === undefined) return
  const held = unsavedOf(shelf, deck)
  const rest = held.filter((entry) => entry.id !== id)
  if (rest.length !== held.length) write(shelf, deck, rest)
}

export function holdsUnsaved(shelf: Shelf | undefined, deck: string, id: string): boolean {
  return unsavedOf(shelf, deck).some((entry) => entry.id === id)
}

const recovering = new WeakMap<Shelf, Map<string, Promise<void>>>()

export function recoverUnsaved(
  shelf: Shelf | undefined,
  deck: string,
  replay: (entry: Unsaved) => Promise<unknown>,
): Promise<void> {
  if (shelf === undefined) return Promise.resolve()
  const decks = recovering.get(shelf) ?? new Map<string, Promise<void>>()
  recovering.set(shelf, decks)
  const known = decks.get(deck)
  if (known !== undefined) return known
  const entries = unsavedOf(shelf, deck)
  const done = (async () => {
    for (const entry of entries) {
      try {
        await replay(entry)
      } catch {
        return
      }
      releaseUnsaved(shelf, deck, entry.id)
    }
  })()
  decks.set(deck, done)
  return done
}
