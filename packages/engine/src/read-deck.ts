import type { DeckId } from "@airdesign/catalog"
import { readDeckId } from "@airdesign/catalog"
import {
  elementGone,
  bytesOf,
  presentSlides,
  slideGone,
  currentBox,
  currentValue,
  floorNodes,
  openingElement,
  readElementId,
  shapeOf,
  version,
  type Box,
  type ElementId,
  type NodeRegister,
  type Register,
  type IndexElement,
  type IndexSlide,
  type Kind,
} from "@airdesign/document"

import type { Deck } from "./call.js"

export const readTokens = 8000

export type ReadElement = {
  readonly node: ElementId
  readonly slide: string
  readonly value: string | null
  readonly kind?: Kind
  readonly grouped?: boolean
  readonly version: number
  readonly box?: Box | null
  readonly closed?: true
}

export type ReadDeckAnswer = {
  readonly ok: true
  readonly revision: number
  readonly elements: readonly ReadElement[]
  readonly slides: readonly IndexSlide[]
  readonly index: "missing" | "pending" | "ready"
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

function elementOf(
  node: ElementId,
  body: NodeRegister | undefined,
  runId: string | null,
  indexed?: IndexElement,
): ReadElement {
  const box = (body === undefined ? null : currentBox(body)) ?? indexed?.box ?? null
  const held = {
    node,
    slide: shapeOf(node).slide,
    value: body === undefined ? (indexed?.value ?? null) : currentValue(body),
    version: body === undefined ? 0 : version(body),
    ...(indexed === undefined ? {} : { kind: indexed.kind, grouped: indexed.grouped }),
  }
  const withBox = box === null && indexed === undefined ? held : { ...held, box }
  if (body === undefined || !closedTo(body, runId)) return withBox
  return { ...withBox, closed: true }
}

function knownNodes(register: Register): ElementId[] {
  const nodes: ElementId[] = []
  const opening = [...(register.index?.elements.map((element) => element.node) ?? []), ...floorNodes(register)]
  for (const node of opening) {
    if (register.elements[node] !== undefined && !register.nodes.includes(node)) continue
    nodes.push(node)
  }
  for (const node of register.nodes) {
    if (readElementId(node) === undefined || register.elements[node] === undefined || nodes.includes(node)) continue
    nodes.push(node)
  }
  nodes.sort(byId)
  return nodes.filter((node) => !elementGone(register, node))
}

type ReadHead = Pick<ReadDeckAnswer, "revision" | "slides" | "index">

function readAnswer(head: ReadHead, elements: readonly ReadElement[], cursor?: string): ReadDeckAnswer {
  if (cursor === undefined) return { ok: true, ...head, elements }
  return { ok: true, ...head, elements, cursor }
}

function packRead(
  head: ReadHead,
  nodes: readonly ElementId[],
  elementOfNode: (node: ElementId) => ReadElement,
): ReadDeckAnswer {
  const chosen: ReadElement[] = []
  for (const [index, node] of nodes.entries()) {
    const element = elementOfNode(node)
    const more = index + 1 < nodes.length
    const trial = readAnswer(head, [...chosen, element], more ? element.node : undefined)
    if (chosen.length > 0 && !withinRead(readReport(readLead(head.revision), trial))) {
      const last = chosen[chosen.length - 1]
      if (last === undefined) break
      return readAnswer(head, chosen, last.node)
    }
    chosen.push(element)
  }
  return readAnswer(head, chosen)
}

export function readDeckPage(
  deck: Deck,
  query: { readonly slide?: string; readonly cursor?: string; readonly runId: string | null },
): ReadDeckAnswer {
  const nodes = knownNodes(deck.register).filter((node) => {
    if (slideGone(deck.register, shapeOf(node).slide)) return false
    if (query.slide !== undefined && shapeOf(node).slide !== query.slide) return false
    if (query.cursor !== undefined && !(node > query.cursor)) return false
    return true
  })
  const index = deck.register.index
  return packRead(
    {
      revision: deck.revision,
      slides:
        deck.register.order.length === 0
          ? (index?.slides ?? [])
          : presentSlides(deck.register).map(({ id }, position) => ({ id, position })),
      index: index === undefined ? "missing" : index.elements.length === index.total ? "ready" : "pending",
    },
    nodes,
    (node) => elementOf(node, deck.register.elements[node], query.runId, openingElement(deck.register, node)),
  )
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
