import { readDeckId } from "@airdesign/catalog"
import { bytesOf, limits } from "@airdesign/document"
import { readSlot, writeSlot } from "./store.js"

export type DeckParts = {
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly file: Uint8Array
  readonly name?: string
}

type PartRow = {
  readonly names: Readonly<Record<string, string>>
  readonly file: string
  readonly name?: string
}

export type PartsResult =
  | {
      readonly ok: true
      readonly parts: Map<string, Uint8Array>
      readonly file: Uint8Array
      readonly name?: string
    }
  | { readonly ok: false; readonly refusal: "deck" | "absent" | "limit" }

function partKey(deck: string): string {
  return `${deck}\u0001`
}

function isPartRow(value: unknown): value is PartRow {
  if (typeof value !== "object" || value === null) return false
  const row = value as { names?: unknown; file?: unknown; name?: unknown }
  const names = row.names
  if (typeof names !== "object" || names === null || Array.isArray(names)) return false
  return typeof row.file === "string" && (row.name === undefined || typeof row.name === "string")
}

export async function putParts(deck: string, parts: DeckParts): Promise<PartsResult> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return parsed
  const [named, file] = await Promise.all([
    Promise.all([...parts.parts].map(async ([name, bytes]) => [name, await putPart(bytes)] as const)),
    putPart(parts.file),
  ])
  const row: PartRow = {
    names: Object.fromEntries(named),
    file,
    ...(parts.name === undefined ? {} : { name: parts.name }),
  }
  if (bytesOf(JSON.stringify(row)) >= limits.row) return { ok: false, refusal: "limit" }
  await writeSlot(partKey(parsed.deck), row)
  return {
    ok: true,
    parts: new Map(parts.parts),
    file: parts.file,
    ...(parts.name === undefined ? {} : { name: parts.name }),
  }
}

export async function getParts(deck: string): Promise<PartsResult> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return parsed
  const stored = await readSlot(partKey(parsed.deck))
  if (!isPartRow(stored)) return { ok: false, refusal: "absent" }
  const parts = new Map<string, Uint8Array>()
  for (const [name, hash] of Object.entries(stored.names)) {
    if (typeof hash !== "string") return { ok: false, refusal: "absent" }
    parts.set(name, await getPart(hash))
  }
  const file = await getPart(stored.file)
  return { ok: true, parts, file, ...(stored.name === undefined ? {} : { name: stored.name }) }
}

export function hex(buffer: ArrayBuffer): string {
  let text = ""
  for (const byte of new Uint8Array(buffer)) text += byte.toString(16).padStart(2, "0")
  return text
}

export function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength))
  copy.set(bytes)
  return copy
}

export async function putPart(bytes: Uint8Array): Promise<string> {
  const payload = owned(bytes)
  const hash = hex(await crypto.subtle.digest("SHA-256", payload))
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(hash, { create: true })
  const writable = await handle.createWritable()
  await writable.write(payload)
  await writable.close()
  return hash
}

export async function getPart(hash: string): Promise<Uint8Array> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(hash)
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}
