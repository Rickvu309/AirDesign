import { deckName } from "@airdesign/catalog"
import { connect, putParts, queueOriginal } from "@airdesign/live"
import { readPackage } from "@airdesign/pptx"
import { server } from "@/commit-edit"
import { indexedParts } from "@/index-deck"
import type { ImportFailureReason } from "@/copy/import-failure-words"

export type ImportedDeck = {
  readonly id: string
  readonly name: string
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly file: Uint8Array
}

export type ImportResult =
  | { readonly ok: true; readonly deck: ImportedDeck }
  | { readonly ok: false; readonly reason: ImportFailureReason }

export async function saveDeck(
  parts: ReadonlyMap<string, Uint8Array>,
  file: Uint8Array,
  name?: string,
  options: { readonly mint?: () => string } = {},
): Promise<string | null> {
  const mint = options.mint ?? crypto.randomUUID.bind(crypto)
  const deckId = mint()
  const indexed = await connect(server).index(deckId, indexedParts(parts), true)
  if (!indexed.ok) return null
  const saved = await putParts(deckId, { parts, file, ...(name === undefined ? {} : { name }) })
  if (saved.ok) await queueOriginal(deckId)
  return saved.ok ? deckId : null
}

export async function importDeck(file: File): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const read = await readPackage(bytes)
  if (!read.ok) return { ok: false, reason: read.reason === "limit" ? read.limit : read.reason }
  const name = deckName(file.name)
  const id = await saveDeck(read.parts, bytes, name)
  if (id === null) return { ok: false, reason: "save" }
  return { ok: true, deck: { id, name, parts: read.parts, file: bytes } }
}
