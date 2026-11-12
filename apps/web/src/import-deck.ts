import { deckName, deckRoutes } from "@airdesign/catalog"
import { connect, putParts, queueOriginal } from "@airdesign/live"
import { indexPackage, readPackage } from "@airdesign/pptx"
import { server } from "@/commit-edit"
import type { ImportFailureReason } from "@/decks/import-failure-words"
import { ensureMarkup } from "@/markup"

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
  const indexed = await connect(server).index(deckId, indexPackage(parts))
  if (!indexed.ok) return null
  const saved = await putParts(deckId, { parts, file, ...(name === undefined ? {} : { name }) })
  if (saved.ok) await queueOriginal(deckId)
  return saved.ok ? deckId : null
}

export async function importDeck(file: File): Promise<ImportResult> {
  await ensureMarkup()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const read = await readPackage(bytes)
  if (!read.ok) return { ok: false, reason: read.reason === "limit" ? read.limit : read.reason }
  const name = deckName(file.name)
  const id = await saveDeck(read.parts, bytes, name)
  if (id === null) return { ok: false, reason: "save" }
  return { ok: true, deck: { id, name, parts: read.parts, file: bytes } }
}

export async function nameImportedDeck(imported: { readonly id: string; readonly name: string }) {
  try {
    const opened = await connect(server).open(imported.id)
    if (!opened.ok) return
    await connect(server).flush(imported.id)
    await fetch(deckRoutes.rename.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deck: imported.id, name: imported.name }),
    })
  } catch {}
}
