import { deckRoutes, type WireRefusal } from "@airdesign/catalog"
import { hex, owned } from "./part.js"
import { post } from "./remote.js"

export type OriginalResult =
  | { readonly ok: true; readonly file: Uint8Array }
  | { readonly ok: false; readonly refusal: WireRefusal }

async function sha256(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", owned(bytes)))
}

function sentHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== "content-length"))
}

export async function sendOriginal(deck: string, file: Uint8Array): Promise<{ readonly ok: boolean }> {
  try {
    const signed = deckRoutes.originalUpload.result(
      await post(deckRoutes.originalUpload.path, { deck, bytes: file.byteLength, sha256: await sha256(file) }),
    )
    if (!signed.ok) return { ok: false }
    const put = await fetch(signed.url, { method: "PUT", headers: sentHeaders(signed.headers), body: owned(file) })
    if (!put.ok) return { ok: false }
    const done = deckRoutes.originalDone.result(await post(deckRoutes.originalDone.path, { deck }))
    return { ok: done.ok }
  } catch {
    return { ok: false }
  }
}

export async function fetchOriginal(deck: string): Promise<OriginalResult> {
  try {
    const signed = deckRoutes.original.result(await post(deckRoutes.original.path, { deck }))
    if (!signed.ok) return signed
    const response = await fetch(signed.url)
    if (!response.ok) return { ok: false, refusal: "storage" }
    const file = new Uint8Array(await response.arrayBuffer())
    if (file.byteLength !== signed.bytes || (await sha256(file)) !== signed.sha256.toLowerCase())
      return { ok: false, refusal: "storage" }
    return { ok: true, file }
  } catch {
    return { ok: false, refusal: "storage" }
  }
}
