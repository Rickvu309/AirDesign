export type RawRow = { readonly key: string; readonly value?: unknown }

export type RawDeviceRows = {
  readonly rows: readonly RawRow[]
  readonly shelf: Readonly<Record<string, string>>
}

export type DeckRows = {
  readonly account: string | null
  readonly deck: string
  revision?: unknown
  head?: unknown
  aside?: unknown
  sectionStarts?: unknown
  readonly confirmed: unknown[]
  readonly pending: unknown[]
  unsaved?: unknown
  readonly slots: string[]
}

export type DeviceRows = {
  readonly decks: readonly DeckRows[]
  readonly device: { readonly slots: readonly string[]; readonly shelf: Readonly<Record<string, unknown>> }
}

const scope = "(?:^|\\u0005)"
const deckName = "[A-Za-z0-9_-]+"
const valuedTail = "(?:\\u0000[cp]\\u0000\\d+|\\u0002(?:head|revision|sectionStarts)|\\u0003aside)$"

export const valuedKey = new RegExp(`${scope}${deckName}${valuedTail}`)

const deckKey = new RegExp(`^(?:([^\\u0005]*)\\u0005)?(${deckName})([\\u0000-\\u0004].*)$`, "s")
const unsavedKey = /^airdesign:unsaved:([^:]+):([A-Za-z0-9_-]+)$/

const readable = (text: string) => JSON.stringify(text).slice(1, -1)

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function deviceRows(raw: RawDeviceRows): DeviceRows {
  const decks = new Map<string, DeckRows>()
  const deckOf = (account: string | null, deck: string) => {
    const name = `${account ?? ""}\u0005${deck}`
    const known = decks.get(name)
    if (known !== undefined) return known
    const made: DeckRows = { account, deck, confirmed: [], pending: [], slots: [] }
    decks.set(name, made)
    return made
  }
  const slots: string[] = []
  const shelf: Record<string, unknown> = {}
  for (const { key, value } of [...raw.rows].sort((left, right) => (left.key < right.key ? -1 : 1))) {
    const found = deckKey.exec(key)
    if (found === null) {
      slots.push(readable(key))
      continue
    }
    const [, account, deck, tail] = found as unknown as [string, string | undefined, string, string]
    const rows = deckOf(account ?? null, deck)
    if (tail.startsWith("\u0000c\u0000")) rows.confirmed.push(value)
    else if (tail.startsWith("\u0000p\u0000")) rows.pending.push(value)
    else if (tail === "\u0002head") rows.head = value
    else if (tail === "\u0002revision") rows.revision = value
    else if (tail === "\u0002sectionStarts") rows.sectionStarts = value
    else if (tail === "\u0003aside") rows.aside = value
    else rows.slots.push(readable(tail))
  }
  for (const [key, text] of Object.entries(raw.shelf)) {
    const unsaved = unsavedKey.exec(key)
    if (unsaved === null) shelf[readable(key)] = parsed(text)
    else deckOf(unsaved[1] ?? null, unsaved[2] ?? "").unsaved = parsed(text)
  }
  return { decks: [...decks.values()], device: { slots, shelf } }
}
