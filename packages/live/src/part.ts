import { readDeckId } from "@airdesign/catalog"
import { readSlot, rowCap, writeSlot } from "./store.js"

export type ShapeRef = { readonly part: string; readonly shape: string }

export type DeckParts = {
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly nodes: { readonly a: ShapeRef }
}

type PartRow = {
  readonly names: Readonly<Record<string, string>>
  readonly nodes: { readonly a: ShapeRef }
}

export type PartsResult =
  | { readonly ok: true; readonly parts: Map<string, Uint8Array>; readonly nodes: { readonly a: ShapeRef } }
  | { readonly ok: false; readonly refusal: "deck" | "absent" | "limit" }

function partKey(deck: string): string {
  return `${deck}\u0001`
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function isPartRow(value: unknown): value is PartRow {
  if (typeof value !== "object" || value === null) return false
  const row = value as { names?: unknown; nodes?: { a?: { part?: unknown; shape?: unknown } } }
  const names = row.names
  const shape = row.nodes?.a
  if (typeof names !== "object" || names === null || Array.isArray(names)) return false
  if (shape === undefined) return false
  return typeof shape.part === "string" && typeof shape.shape === "string"
}

export async function putParts(deck: string, parts: DeckParts): Promise<PartsResult> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return parsed
  const names: Record<string, string> = {}
  for (const [name, bytes] of parts.parts) names[name] = await putPart(bytes)
  const row: PartRow = { names, nodes: parts.nodes }
  if (jsonBytes(row) >= rowCap) return { ok: false, refusal: "limit" }
  await writeSlot(partKey(parsed.deck), row)
  return { ok: true, parts: new Map(parts.parts), nodes: parts.nodes }
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
  return { ok: true, parts, nodes: stored.nodes }
}

function hex(buffer: ArrayBuffer): string {
  let text = ""
  for (const byte of new Uint8Array(buffer)) text += byte.toString(16).padStart(2, "0")
  return text
}

function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
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
