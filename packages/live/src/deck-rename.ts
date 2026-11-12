import { deckRoutes } from "@airdesign/catalog"
import { renameParts } from "./part.js"
import { post } from "./remote.js"
import { readSlot, writeSlot } from "./store.js"

const key = (deck: string) => `${deck}\u0003name`

export async function flushRename(deck: string): Promise<{ readonly ok: boolean }> {
  try {
    const name = await readSlot(key(deck))
    if (typeof name !== "string") return { ok: true }
    const answer = deckRoutes.rename.result(await post(deckRoutes.rename.path, { deck, name }))
    if (!answer.ok) return { ok: false }
    if ((await readSlot(key(deck))) === name) await writeSlot(key(deck), false)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function renameDeck(deck: string, name: string): Promise<{ readonly ok: boolean }> {
  const renamed = await renameParts(deck, name)
  if (!renamed.ok) return renamed
  await writeSlot(key(deck), name)
  return flushRename(deck)
}
