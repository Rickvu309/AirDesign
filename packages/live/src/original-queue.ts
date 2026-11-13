import { connect } from "./cache.js"
import { flushRename, queuedName, queueRename } from "./deck-rename.js"
import { flushStar, queuedStar } from "./deck-star.js"
import { flushMedia } from "./media.js"
import { sendOriginal } from "./original.js"
import { getParts } from "./part.js"
import type { Remote } from "./remote.js"
import { changeSlot, readSlot, writeSlot } from "./store.js"

const key = (deck: string) => `${deck}\u0003original`
const unopenedKey = "\u0007unopened"
const settled = new Set(["deck", "owner", "deleted"])

export type UnopenedDeck = { readonly deck: string; readonly name: string; readonly created: string }

type Unopened = Readonly<Record<string, { readonly name: string; readonly created: string }>>

function unopenedOf(raw: unknown): Unopened {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, { name: string; created: string }] =>
        typeof entry[1] === "object" &&
        entry[1] !== null &&
        typeof entry[1].name === "string" &&
        typeof entry[1].created === "string",
    ),
  )
}

function forget(gone: (deck: string) => boolean): Promise<void> {
  return changeSlot(unopenedKey, (raw) =>
    Object.fromEntries(Object.entries(unopenedOf(raw)).filter(([deck]) => !gone(deck))),
  )
}

export async function queueOriginal(deck: string, now: () => number = Date.now): Promise<void> {
  const stored = await getParts(deck)
  const name = stored.ok ? stored.name : undefined
  if (name !== undefined) await queueRename(deck, name)
  const created = new Date(now()).toISOString()
  await changeSlot(unopenedKey, (raw) => ({ ...unopenedOf(raw), [deck]: { name: name ?? "", created } }))
  await writeSlot(key(deck), true)
}

export async function flushOriginal(deck: string): Promise<{ readonly ok: boolean }> {
  const original = await sendHeldOriginal(deck)
  const media = await flushMedia(deck)
  return { ok: original.ok && media.ok }
}

async function sendHeldOriginal(deck: string): Promise<{ readonly ok: boolean }> {
  const renamed = await flushRename(deck)
  try {
    if ((await readSlot(key(deck))) !== true) return { ok: true }
    if (!renamed.ok) return { ok: false }
    const stored = await getParts(deck)
    if (!stored.ok) return { ok: false }
    const sent = await sendOriginal(deck, stored.file)
    if (sent.ok) await writeSlot(key(deck), false)
    return sent
  } catch {
    return { ok: false }
  }
}

type Queued = { readonly names: ReadonlyMap<string, string>; readonly stars: ReadonlyMap<string, boolean> }

function held<Value>(entries: readonly (readonly [string, Value | undefined])[]): Map<string, Value> {
  return new Map(entries.filter((entry): entry is readonly [string, Value] => entry[1] !== undefined))
}

export async function sendQueued(decks: readonly string[]): Promise<Queued> {
  const names = held(await Promise.all(decks.map(async (deck) => [deck, await queuedName(deck)] as const)))
  const stars = held(await Promise.all(decks.map(async (deck) => [deck, await queuedStar(deck)] as const)))
  for (const deck of names.keys()) void flushOriginal(deck)
  for (const deck of stars.keys()) void flushStar(deck)
  return { names, stars }
}

async function sendOpen(remote: Remote, deck: string): Promise<void> {
  const live = connect(remote)
  const opened = await live.open(deck).catch(() => null)
  if (opened === null || (!opened.ok && !settled.has(opened.refusal))) return
  await forget((each) => each === deck)
  if (!opened.ok) return
  await live.flush(deck)
  await flushOriginal(deck)
}

export async function sendUnopened(remote: Remote, listed: readonly string[]): Promise<readonly UnopenedDeck[]> {
  const known = new Set(listed)
  const held = Object.entries(unopenedOf(await readSlot(unopenedKey)))
  if (held.some(([deck]) => known.has(deck))) await forget((deck) => known.has(deck))
  const decks = await Promise.all(
    held
      .filter(([deck]) => !known.has(deck))
      .map(async ([deck, entry]) => ({ deck, name: (await queuedName(deck)) ?? entry.name, created: entry.created })),
  )
  for (const { deck } of decks) void sendOpen(remote, deck).catch(() => undefined)
  return decks
}
