import type { DeckId } from "@airdesign/catalog"
import { readDeckId } from "@airdesign/catalog"
import {
  bytesOf,
  currentBox,
  currentValue,
  readElementId,
  shapeOf,
  version,
  type Box,
  type ElementId,
  type NodeRegister,
  type Register,
} from "@airdesign/document"

import type { Deck } from "./call.js"

export const readTokens = 8000

export type ReadElement = {
  readonly node: ElementId
  readonly slide: string
  readonly value: string
  readonly version: number
  readonly box?: Box
  readonly closed?: true
}

export type ReadDeckAnswer = {
  readonly ok: true
  readonly revision: number
  readonly elements: readonly ReadElement[]
  readonly cursor?: string
}

export type OwnedRow = {
  readonly deck: string
  readonly name: string
  readonly owner: string
  readonly deleted: boolean
  readonly trash: boolean
}

export type OwnedDeck = {
  readonly deck: DeckId
  readonly name: string
  readonly trash: boolean
}

export type ListDeckAnswer = {
  readonly ok: true
  readonly decks: readonly OwnedDeck[]
  readonly cursor?: string
}

export function readLead(revision: number): string {
  return `Read revision ${String(revision)}.`
}

export const listLead = "Decks this account owns."

export function readReport(lead: string, answer: unknown): string {
  return JSON.stringify({
    content: [
      { type: "text", text: lead },
      { type: "text", text: JSON.stringify(answer) },
    ],
    structuredContent: answer,
  })
}

export function withinRead(report: string): boolean {
  return Math.ceil(bytesOf(report) / 4) <= readTokens
}

function byId(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function closedTo(body: NodeRegister, runId: string | null): boolean {
  if (body.phase !== "running" || body.runId === null) return false
  if (body.guarded) return true
  return body.runId !== runId
}

function elementOf(node: ElementId, body: NodeRegister, runId: string | null): ReadElement {
  const box = currentBox(body)
  const held = {
    node,
    slide: shapeOf(node).slide,
    value: currentValue(body),
    version: version(body),
  }
  const withBox = box === null ? held : { ...held, box }
  if (!closedTo(body, runId)) return withBox
  return { ...withBox, closed: true }
}

function knownNodes(register: Register): ElementId[] {
  const nodes: ElementId[] = []
  for (const node of register.nodes) {
    if (readElementId(node) === undefined || register.elements[node] === undefined || nodes.includes(node)) continue
    nodes.push(node)
  }
  nodes.sort(byId)
  return nodes
}

function readAnswer(revision: number, elements: readonly ReadElement[], cursor?: string): ReadDeckAnswer {
  if (cursor === undefined) return { ok: true, revision, elements }
  return { ok: true, revision, elements, cursor }
}

function packRead(revision: number, elements: readonly ReadElement[]): ReadDeckAnswer {
  const chosen: ReadElement[] = []
  for (const [index, element] of elements.entries()) {
    const more = index + 1 < elements.length
    const trial = readAnswer(revision, [...chosen, element], more ? element.node : undefined)
    if (chosen.length > 0 && !withinRead(readReport(readLead(revision), trial))) {
      const last = chosen[chosen.length - 1]
      if (last === undefined) break
      return readAnswer(revision, chosen, last.node)
    }
    chosen.push(element)
  }
  return readAnswer(revision, chosen)
}

export function readDeckPage(
  deck: Deck,
  query: { readonly slide?: string; readonly cursor?: string; readonly runId: string | null },
): ReadDeckAnswer {
  const nodes = knownNodes(deck.register).filter((node) => {
    if (query.slide !== undefined && shapeOf(node).slide !== query.slide) return false
    if (query.cursor !== undefined && !(node > query.cursor)) return false
    return true
  })
  const elements = nodes.flatMap((node) => {
    const body = deck.register.elements[node]
    if (body === undefined) return []
    return [elementOf(node, body, query.runId)]
  })
  return packRead(deck.revision, elements)
}

export function ownedDecks(rows: readonly OwnedRow[], email: string): OwnedDeck[] {
  const decks: OwnedDeck[] = []
  for (const row of rows) {
    if (row.deleted || row.owner !== email) continue
    const parsed = readDeckId(row.deck)
    if (!parsed.ok) continue
    decks.push({ deck: parsed.deck, name: row.name, trash: row.trash })
  }
  return decks
}

function listAnswer(decks: readonly OwnedDeck[], cursor?: string): ListDeckAnswer {
  if (cursor === undefined) return { ok: true, decks }
  return { ok: true, decks, cursor }
}

function packList(decks: readonly OwnedDeck[]): ListDeckAnswer {
  const chosen: OwnedDeck[] = []
  for (const [index, row] of decks.entries()) {
    const more = index + 1 < decks.length
    const trial = listAnswer([...chosen, row], more ? row.deck : undefined)
    if (chosen.length > 0 && !withinRead(readReport(listLead, trial))) {
      const last = chosen[chosen.length - 1]
      if (last === undefined) break
      return listAnswer(chosen, last.deck)
    }
    chosen.push(row)
  }
  return listAnswer(chosen)
}

export function pageOwned(decks: readonly OwnedDeck[], cursor?: string): ListDeckAnswer {
  if (cursor === undefined) return packList(decks)
  const at = decks.findIndex((row) => row.deck === cursor)
  if (at < 0) return { ok: true, decks: [] }
  return packList(decks.slice(at + 1))
}
