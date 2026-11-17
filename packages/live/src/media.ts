import { deckRoutes } from "@airdesign/catalog"
import { getPart, hex, owned, putPart } from "./part.js"
import { post } from "./remote.js"
import { changeSlot, readSlot } from "./store.js"

const queueKey = (deck: string) => `${deck}\u0003media`
const heldKey = (deck: string) => `${deck}\u0003pictures`

function hashList(stored: unknown): readonly string[] {
  return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : []
}

async function hashes(key: string): Promise<readonly string[]> {
  return hashList(await readSlot(key))
}

async function listed(key: string, sha256: string): Promise<void> {
  await changeSlot(key, (stored) => [...new Set([...hashList(stored), sha256])])
}

const queued = (deck: string) => hashes(queueKey(deck))

export async function keepMedia(deck: string, bytes: Uint8Array): Promise<string> {
  const sha256 = await putPart(bytes)
  await listed(heldKey(deck), sha256)
  await listed(queueKey(deck), sha256)
  return sha256
}

async function sendMedia(deck: string, sha256: string): Promise<boolean> {
  const bytes = await getPart(sha256)
  const signed = deckRoutes.mediaUpload.result(
    await post(deckRoutes.mediaUpload.path, { deck, bytes: bytes.byteLength, sha256 }),
  )
  if (!signed.ok) return false
  const headers = Object.fromEntries(
    Object.entries(signed.headers).filter(([name]) => name.toLowerCase() !== "content-length"),
  )
  const put = await fetch(signed.url, { method: "PUT", headers, body: owned(bytes) })
  return put.ok || put.status === 412
}

export async function flushMedia(deck: string): Promise<{ readonly ok: boolean }> {
  try {
    const waiting = await queued(deck)
    for (const sha256 of waiting) {
      if (!(await sendMedia(deck, sha256))) return { ok: false }
      await changeSlot(queueKey(deck), (stored) => hashList(stored).filter((each) => each !== sha256))
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

async function fetchMedia(deck: string, sha256: string): Promise<Uint8Array | undefined> {
  try {
    const signed = deckRoutes.media.result(await post(deckRoutes.media.path, { deck, sha256 }))
    if (!signed.ok) return undefined
    const response = await fetch(signed.url)
    if (!response.ok) return undefined
    const bytes = new Uint8Array(await response.arrayBuffer())
    const digest = hex(await crypto.subtle.digest("SHA-256", owned(bytes)))
    if (bytes.byteLength !== signed.bytes || digest !== sha256) return undefined
    await putPart(bytes)
    await listed(heldKey(deck), sha256)
    return bytes
  } catch {
    return undefined
  }
}

async function deviceMedia(deck: string, sha256: string): Promise<Uint8Array | undefined> {
  try {
    if (!(await hashes(heldKey(deck))).includes(sha256)) return undefined
    return await getPart(sha256)
  } catch {
    return undefined
  }
}

export async function readMedia(deck: string, hashes: readonly string[]): Promise<ReadonlyMap<string, Uint8Array>> {
  const found = new Map<string, Uint8Array>()
  for (const sha256 of hashes) {
    const bytes = (await deviceMedia(deck, sha256)) ?? (await fetchMedia(deck, sha256))
    if (bytes !== undefined) found.set(sha256, bytes)
  }
  return found
}
