import { deckRoutes } from "@airdesign/catalog"
import {
  adoptDeck,
  connect,
  fetchOriginal,
  getParts,
  keepQueued,
  memoryRemote,
  putParts,
  type Remote,
} from "@airdesign/live"
import { readPackage } from "@airdesign/pptx"
import type { Register } from "@airdesign/document"

async function listedName(deck: string): Promise<string | undefined> {
  try {
    const response = await fetch(deckRoutes.list.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const listed = deckRoutes.list.result(await response.json())
    return listed.ok ? listed.decks.find((each) => each.deck === deck)?.name : undefined
  } catch {
    return undefined
  }
}

export async function deckParts(deck: string) {
  const stored = await getParts(deck)
  if (stored.ok) return stored
  const original = await fetchOriginal(deck)
  if (!original.ok) return original.refusal === "session" ? "signed-out" : null
  const read = await readPackage(original.file)
  if (!read.ok) return null
  const name = await listedName(deck)
  const saved = await putParts(deck, {
    parts: read.parts,
    file: original.file,
    ...(name === undefined ? {} : { name }),
  })
  return saved.ok ? saved : null
}

export async function deviceCopy(deck: string, server: Remote) {
  await adoptDeck(
    deck,
    async () =>
      (
        await connect(server)
          .open(deck)
          .catch(() => null)
      )?.ok === true,
  )
  await keepQueued()
  const stored = await getParts(deck)
  if (!stored.ok) return null
  const opened = await connect(memoryRemote()).openDeck(deck)
  return opened.ok ? { stored, register: opened.register } : null
}

const closing: ReadonlySet<string> = new Set(["owner", "deleted", "deck"])

export function closesDeck(refusal: string): boolean {
  return closing.has(refusal)
}

export async function deviceRegister(deck: string): Promise<Register | null> {
  const opened = await connect(memoryRemote()).openDeck(deck)
  return opened.ok ? opened.register : null
}
