import { readDeckId, type DeckId, type WireRefusal } from "@airdesign/catalog"
import {
  appendIndex,
  bytesOf,
  format,
  limits,
  readIndexPage,
  type DeckIndex,
  type IndexPage,
} from "@airdesign/document"
import { gridOpening } from "./grid-opening.js"
import { keepGridOpening } from "./held.js"
import type { CommitResult, OpenResult, Remote } from "./remote.js"
import { installSlots, readSlot, replaceSlots, swapSlot } from "./store.js"

type ImportIndex = Pick<DeckIndex, "slides" | "elements" | "palettes" | "templates" | "sectionStarts">
type Queue = { readonly count: number; readonly sent: number; readonly once?: string; readonly format?: number }
const key = (deck: string, part: string) => `${deck}\u0002layouts\u0002${part}`
const chunkSize = Math.floor(limits.row / 4)

function pageSlots(deck: string, n: number, page: IndexPage): { readonly key: string; readonly value: unknown }[] {
  const text = JSON.stringify(page)
  if (bytesOf(text) < limits.row) return [{ key: key(deck, String(n)), value: page }]
  const chunks: string[] = []
  for (let at = 0; at < text.length; at += chunkSize) chunks.push(text.slice(at, at + chunkSize))
  return [
    { key: key(deck, String(n)), value: { chunks: chunks.length } },
    ...chunks.map((value, part) => ({ key: key(deck, `${n}:${part}`), value })),
  ]
}

async function storedPage(deck: string, n: number): Promise<IndexPage | null> {
  const raw = await readSlot(key(deck, String(n)))
  if (typeof raw !== "object" || raw === null || !("chunks" in raw)) return readIndexPage(raw)
  if (
    typeof raw.chunks !== "number" ||
    !Number.isSafeInteger(raw.chunks) ||
    raw.chunks < 1 ||
    raw.chunks > Math.ceil(limits.body / chunkSize)
  )
    return null
  const chunks: string[] = []
  for (let part = 0; part < raw.chunks; part++) {
    const value = await readSlot(key(deck, `${n}:${part}`))
    if (typeof value !== "string") return null
    chunks.push(value)
  }
  try {
    return readIndexPage(JSON.parse(chunks.join("")))
  } catch {
    return null
  }
}

function queue(raw: unknown): Queue | null {
  if (typeof raw !== "object" || raw === null || !("count" in raw) || !("sent" in raw)) return null
  if (typeof raw.count !== "number" || typeof raw.sent !== "number") return null
  const stamped = "format" in raw && typeof raw.format === "number" ? { format: raw.format } : {}
  if (!("once" in raw)) return { count: raw.count, sent: raw.sent, ...stamped }
  if (typeof raw.once !== "string") return null
  return { count: raw.count, sent: raw.sent, once: raw.once, ...stamped }
}

const widestDeck = "d".repeat(64)

export function indexPages(
  index: ImportIndex,
  once: () => string,
):
  | { readonly ok: true; readonly pages: readonly IndexPage[] }
  | { readonly ok: false; readonly refusal: "present" | "stale" | "limit" } {
  const shared = {
    format,
    ...(index.sectionStarts === undefined ? {} : { sectionStarts: index.sectionStarts }),
    ...(index.templates === undefined ? {} : { templates: index.templates }),
    ...(index.palettes === undefined ? {} : { palettes: index.palettes }),
  }
  const pages: IndexPage[] = []
  let held: DeckIndex | undefined
  for (let offset = 0; offset < index.elements.length || pages.length === 0;) {
    const elements = []
    const token = once()
    for (const element of index.elements.slice(offset, offset + limits.batch)) {
      const trial = {
        deck: widestDeck,
        ...shared,
        once: token,
        offset,
        total: index.elements.length,
        slides: index.slides,
        elements: [...elements, element],
      }
      if (elements.length > 0 && bytesOf(JSON.stringify(trial)) >= limits.row - 256) break
      elements.push(element)
    }
    const page = readIndexPage({
      ...shared,
      once: token,
      offset,
      total: index.elements.length,
      slides: index.slides,
      elements,
    })
    if (page === null) return { ok: false, refusal: "limit" }
    const next = appendIndex(held, page)
    if (!next.ok) return next
    held = next.index
    pages.push(page)
    offset += elements.length
    if (offset === index.elements.length) break
  }
  return { ok: true, pages }
}

async function keepIndex(deck: DeckId, index: ImportIndex, once: () => string) {
  const queued = queue(await readSlot(key(deck, "queue")))
  if (queued !== null && (queued.format ?? 1) >= format) return { ok: true as const }
  const split = indexPages(index, once)
  if (!split.ok) return split
  const { pages } = split
  const puts = [
    ...pages.flatMap((page, n) => pageSlots(deck, n, page)),
    { key: key(deck, "queue"), value: { count: pages.length, sent: 0, once: pages[0]!.once, format } },
  ]
  await (queued === null ? installSlots(key(deck, "queue"), puts) : replaceSlots(puts))
  return { ok: true as const }
}

export async function queueIndex(
  deck: string,
  index: ImportIndex,
  once: () => string,
  fresh = false,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: WireRefusal }> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return parsed
  const queued = await keepIndex(parsed.deck, index, once)
  if (queued.ok && fresh && index.sectionStarts !== undefined)
    await keepGridOpening(parsed.deck, gridOpening(index.slides, index.sectionStarts))
  return queued
}

export async function sendIndex(
  remote: Remote,
  deck: DeckId,
  open: () => Promise<OpenResult>,
): Promise<(CommitResult & { readonly indexedSections?: true }) | null> {
  let pending = queue(await readSlot(key(deck, "queue")))
  if (pending === null || pending.sent === pending.count) return null
  if (remote.index === undefined) return { ok: false, refusal: "store" }
  const opened = await open()
  if (!opened.ok) return opened
  let revision = opened.revision
  let indexedSections = false
  while (pending.sent < pending.count) {
    const page = await storedPage(deck, pending.sent)
    if (page === null) return { ok: false, refusal: "payload" }
    const answer = await remote.index({ deck, ...page })
    if (!answer.ok && answer.refusal !== "present") return answer
    if (answer.ok && answer.deck !== deck) return { ok: false, refusal: "payload" }
    if (answer.ok) revision = answer.revision
    const was: Queue = pending
    const next: Queue = { ...was, sent: answer.ok ? was.sent + 1 : was.count }
    const kept = await swapSlot(key(deck, "queue"), next, (current) => {
      const stored = queue(current)
      return stored !== null && stored.count === was.count && stored.sent === was.sent && stored.once === was.once
    })
    if (kept && next.sent === next.count) indexedSections = page.sectionStarts !== undefined
    pending = kept ? next : queue(await readSlot(key(deck, "queue")))
    if (pending === null) return { ok: false, refusal: "payload" }
  }
  return { ok: true, deck, revision, key: `${deck}:${revision}`, ...(indexedSections ? { indexedSections: true } : {}) }
}
