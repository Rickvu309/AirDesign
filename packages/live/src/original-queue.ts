import { deckRoutes } from "@airdesign/catalog"
import { flushRename } from "./deck-rename.js"
import { sendOriginal } from "./original.js"
import { getParts } from "./part.js"
import { post } from "./remote.js"
import { readSlot, writeSlot } from "./store.js"

const key = (deck: string) => `${deck}\u0003original`

export async function queueOriginal(deck: string): Promise<void> {
  await writeSlot(key(deck), true)
}

export async function flushOriginal(deck: string): Promise<{ readonly ok: boolean }> {
  await flushRename(deck)
  try {
    if ((await readSlot(key(deck))) !== true) return { ok: true }
    const stored = await getParts(deck)
    if (!stored.ok) return { ok: false }
    if (stored.name !== undefined) {
      const renamed = deckRoutes.rename.result(await post(deckRoutes.rename.path, { deck, name: stored.name }))
      if (!renamed.ok) return { ok: false }
    }
    const sent = await sendOriginal(deck, stored.file)
    if (sent.ok) await writeSlot(key(deck), false)
    return sent
  } catch {
    return { ok: false }
  }
}
