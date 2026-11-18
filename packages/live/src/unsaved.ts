import {
  format,
  limits,
  readBox,
  readRow,
  newerFormat,
  readStoredEdit,
  type Box,
  type Row,
  type SlideCommand,
  type SlideId,
  type StoredRead,
} from "@airdesign/document"

export type Shelf = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

type Entry =
  | {
      readonly kind: "text"
      readonly id: string
      readonly node: string
      readonly floor: string
      readonly value: string
    }
  | { readonly kind: "box"; readonly id: string; readonly node: string; readonly floor: string; readonly box: Box }
  | { readonly kind: "row"; readonly id: string; readonly node: string; readonly floor: string; readonly row: Row }
  | {
      readonly kind: "slide"
      readonly id: string
      readonly file: readonly SlideId[]
      readonly edit: SlideCommand
    }
  | {
      readonly kind: "slides"
      readonly id: string
      readonly file: readonly SlideId[]
      readonly edits: readonly SlideCommand[]
    }

export type Unsaved = Entry & { readonly format?: number }

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
  return entry.kind === "slide" || entry.kind === "slides" || entry.kind === "row"
    ? null
    : `${entry.kind}:${entry.node}`
}

function isEntry(raw: unknown): raw is Unsaved {
  if (typeof raw !== "object" || raw === null) return false
  const entry = raw as Record<string, unknown>
  if (typeof entry.id !== "string") return false
  if (entry.kind === "slide") return Array.isArray(entry.file) && typeof entry.edit === "object" && entry.edit !== null
  if (entry.kind === "slides") return Array.isArray(entry.file) && Array.isArray(entry.edits)
  if (typeof entry.node !== "string" || typeof entry.floor !== "string") return false
  if (entry.kind === "text") return typeof entry.value === "string"
  if (entry.kind === "row") return readRow(entry.row, "text").ok
  return entry.kind === "box" && readBox(entry.box) !== null
}

type Held = Readonly<Record<string, unknown>> & { readonly id: string }

function held(raw: unknown): raw is Held {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) && "id" in raw && typeof raw.id === "string"
}

function heldAt(shelf: Shelf | undefined, key: string): Held[] {
  if (shelf === undefined) return []
  try {
    const raw = shelf.getItem(key)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(held) : []
  } catch {
    return []
  }
}

export function unsavedOf(shelf: Shelf | undefined, account: string, deck: string): Unsaved[] {
  return heldAt(shelf, shelfKey(account, deck)).filter(isEntry)
}

function write(shelf: Shelf, account: string, deck: string, entries: readonly Held[]): void {
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
  return heldAt(shelf, legacyKey(deck)).length > 0
}

export function adoptJournal(shelf: Shelf | undefined, account: string, deck: string): void {
  if (shelf === undefined) return
  const legacy = heldAt(shelf, legacyKey(deck))
  if (legacy.length === 0) return
  if (heldAt(shelf, shelfKey(account, deck)).length === 0) write(shelf, account, deck, legacy)
  try {
    shelf.removeItem(legacyKey(deck))
  } catch {
    return
  }
}

export function keepUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string, entry: Kept): void {
  if (shelf === undefined) return
  const slot = slotOf(entry)
  const next: Unsaved = { ...entry, id, format }
  if (JSON.stringify(next).length > limits.row) return
  const kept = heldAt(shelf, shelfKey(account, deck)).filter(
    (entry) => slot === null || !isEntry(entry) || slotOf(entry) !== slot,
  )
  write(shelf, account, deck, [...kept, next])
}

export function releaseUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string): void {
  if (shelf === undefined) return
  const all = heldAt(shelf, shelfKey(account, deck))
  const rest = all.filter((entry) => entry.id !== id)
  if (rest.length !== all.length) write(shelf, account, deck, rest)
}

export function holdsUnsaved(shelf: Shelf | undefined, account: string, deck: string, id: string): boolean {
  return unsavedOf(shelf, account, deck).some((entry) => entry.id === id)
}

function storedEdit(entry: Unsaved): unknown {
  const stamp = { format: entry.format }
  if (entry.kind === "slide") return { ...stamp, file: entry.file, edits: [entry.edit] }
  if (entry.kind === "slides") return { ...stamp, file: entry.file, edits: entry.edits }
  const value =
    entry.kind === "text"
      ? { value: entry.value }
      : entry.kind === "box"
        ? { property: "box", value: entry.box }
        : entry.row
  return { ...stamp, node: entry.node, floor: entry.floor, value }
}

const payload = { ok: false, refusal: "payload" } as const
const newer = { ok: false, refusal: "newer" } as const

const kinds: readonly unknown[] = ["text", "box", "row", "slide", "slides"]

export function readUnsaved(raw: unknown): StoredRead<Unsaved> {
  if (!held(raw) || !kinds.includes(raw.kind)) return newerFormat(raw) ? newer : payload
  const entry = raw as Unsaved
  const read = readStoredEdit(storedEdit(entry))
  if (!read.ok) return read
  const edit = read.value
  const { id } = entry
  if ("edits" in edit) {
    const [first] = edit.edits
    if (entry.kind === "slides") return { ok: true, value: { kind: "slides", id, file: edit.file, edits: edit.edits } }
    return first === undefined ? payload : { ok: true, value: { kind: "slide", id, file: edit.file, edit: first } }
  }
  const { node, floor = "", value } = edit
  if (node === undefined) return payload
  if (value.v !== undefined) return { ok: true, value: { kind: "row", id, node, floor, row: value } }
  if (value.property === "box") return { ok: true, value: { kind: "box", id, node, floor, box: value.value } }
  return { ok: true, value: { kind: "text", id, node, floor, value: value.value } }
}

type Recovered = "newer" | "payload" | undefined

const recovering = new WeakMap<Shelf, Map<string, Promise<Recovered>>>()

export function recoverUnsaved(
  shelf: Shelf | undefined,
  account: string,
  deck: string,
  replay: (entry: Unsaved) => Promise<unknown>,
): Promise<Recovered> {
  if (shelf === undefined) return Promise.resolve(undefined)
  const decks = recovering.get(shelf) ?? new Map<string, Promise<Recovered>>()
  recovering.set(shelf, decks)
  const lane = shelfKey(account, deck)
  const known = decks.get(lane)
  if (known !== undefined) return known
  const entries = heldAt(shelf, lane)
  const done = (async () => {
    for (const entry of entries) {
      const read = readUnsaved(entry)
      if (!read.ok) return read.refusal
      try {
        await replay(read.value)
      } catch {
        return undefined
      }
      releaseUnsaved(shelf, account, deck, entry.id)
    }
    return undefined
  })()
  decks.set(lane, done)
  return done
}
