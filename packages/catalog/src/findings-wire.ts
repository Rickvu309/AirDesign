import { limits, readElementId, type ElementId } from "@airdesign/document"
import { fieldRefusal, knownKeys, readDeckId, recordOf, type DeckId, type FieldRefusal } from "./wire.js"

export type Overflow = {
  readonly needed: number
  readonly room: number
  readonly fix: { readonly size: number | null; readonly height: number }
}

export type OverflowFinding = { readonly node: ElementId } & Overflow

export type FindingsReport = {
  readonly deck: DeckId
  readonly revision: number
  readonly overflow: readonly OverflowFinding[]
}

const pointsCeiling = 100_000
const sizeCeiling = 4_000

function pointsOf(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= pointsCeiling ? raw : undefined
}

function sizeOf(raw: unknown): number | null | undefined {
  if (raw === null) return null
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= sizeCeiling ? raw : undefined
}

function readFix(raw: unknown): Overflow["fix"] | undefined {
  const fix = recordOf(raw)
  if (fix === undefined || !knownKeys(fix, ["size", "height"]) || !Object.hasOwn(fix, "size")) return undefined
  const size = sizeOf(fix.size)
  const height = pointsOf(fix.height)
  return size === undefined || height === undefined ? undefined : { size, height }
}

function readOverflow(raw: unknown): OverflowFinding | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["node", "needed", "room", "fix"])) return undefined
  const node = typeof body.node === "string" ? readElementId(body.node) : undefined
  const needed = pointsOf(body.needed)
  const room = pointsOf(body.room)
  const fix = readFix(body.fix)
  if (node === undefined || needed === undefined || room === undefined || fix === undefined) return undefined
  return { node, needed, room, fix }
}

export function readFindingsReport(
  raw: unknown,
): ({ readonly ok: true } & FindingsReport) | FieldRefusal | Exclude<ReturnType<typeof readDeckId>, { ok: true }> {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "revision", "overflow"])) return fieldRefusal
  if (!Object.hasOwn(body, "deck") || !Array.isArray(body.overflow)) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deck
  const { revision } = body
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return fieldRefusal
  const rows: unknown[] = body.overflow
  if (rows.length > limits.elements) return fieldRefusal
  const overflow: OverflowFinding[] = []
  const nodes = new Set<ElementId>()
  for (const row of rows) {
    const read = readOverflow(row)
    if (read === undefined || nodes.has(read.node)) return fieldRefusal
    nodes.add(read.node)
    overflow.push(read)
  }
  return { ok: true, deck: deck.deck, revision, overflow }
}
