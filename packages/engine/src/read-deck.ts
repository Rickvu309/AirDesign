import type { DeckId } from "@airdesign/catalog"
import { readDeckId } from "@airdesign/catalog"
import {
  bytesOf,
  foldSlides,
  presentSlides,
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

const sortedNodes = new WeakMap<Register, readonly ElementId[]>()

function knownNodes(register: Register): readonly ElementId[] {
  const kept = sortedNodes.get(register)
  if (kept !== undefined) return kept
  const nodes: ElementId[] = []
  const listed = new Set<ElementId>()
  const registered = new Set(register.nodes)
  const opening = [...(register.index?.elements.map((element) => element.node) ?? []), ...floorNodes(register)]
  for (const node of opening) {
    if (register.elements[node] !== undefined && !registered.has(node)) continue
    nodes.push(node)
    listed.add(node)
  }
  for (const node of register.nodes) {
    if (readElementId(node) === undefined || register.elements[node] === undefined || listed.has(node)) continue
    nodes.push(node)
    listed.add(node)
  }
  const removed = new Set<ElementId>()
  for (const command of register.order) {
    if (command.slide === "element-remove") removed.add(command.node)
  }
  nodes.sort(byId)
  const present = nodes.filter((node) => !removed.has(node))
  sortedNodes.set(register, present)
  return present
}

function firstAfter(nodes: readonly ElementId[], cursor: string): number {
  let low = 0
  let high = nodes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const node = nodes[middle]
    if (node !== undefined && node > cursor) high = middle
    else low = middle + 1
  }
  return low
}

type ReadHead = Pick<ReadDeckAnswer, "revision" | "slides" | "index">

function readAnswer(head: ReadHead, elements: readonly ReadElement[], cursor?: string): ReadDeckAnswer {
  if (cursor === undefined) return { ok: true, ...head, elements }
  return { ok: true, ...head, elements, cursor }
}

function nextWanted(nodes: readonly ElementId[], from: number, wanted: (node: ElementId) => boolean): number {
  let at = from
  while (at < nodes.length) {
    const node = nodes[at]
    if (node !== undefined && wanted(node)) break
    at += 1
  }
  return at
}

function packRead(
  head: ReadHead,
  nodes: readonly ElementId[],
  start: number,
  wanted: (node: ElementId) => boolean,
  elementOfNode: (node: ElementId) => ReadElement,
): ReadDeckAnswer {
  const chosen: ReadElement[] = []
  let at = nextWanted(nodes, start, wanted)
  while (at < nodes.length) {
    const node = nodes[at]
    if (node === undefined) break
    const element = elementOfNode(node)
    const following = nextWanted(nodes, at + 1, wanted)
    const more = following < nodes.length
    const trial = readAnswer(head, [...chosen, element], more ? element.node : undefined)
    if (chosen.length > 0 && !withinRead(readReport(readLead(head.revision), trial))) {
      const last = chosen[chosen.length - 1]
      if (last === undefined) break
      return readAnswer(head, chosen, last.node)
    }
    chosen.push(element)
    at = following
  }
  return readAnswer(head, chosen)
}

export function readDeckPage(
  deck: Deck,
  query: { readonly slide?: string; readonly cursor?: string; readonly runId: string | null },
): ReadDeckAnswer {
  const goneSlides = new Set<string>(foldSlides(deck.register).flatMap((spot) => (spot.present ? [] : [spot.id])))
  const nodes = knownNodes(deck.register)
  const index = deck.register.index
  return packRead(
    {
      revision: deck.revision,
      slides:
        deck.register.order.length === 0
          ? (index?.slides ?? []).map(({ id, position }) => ({ id, position }))
          : presentSlides(deck.register).map(({ id }, position) => ({ id, position })),
      index: index === undefined ? "missing" : index.elements.length === index.total ? "ready" : "pending",
    },
    nodes,
    query.cursor === undefined ? 0 : firstAfter(nodes, query.cursor),
    (node) => {
      const slide = shapeOf(node).slide
      return !goneSlides.has(slide) && (query.slide === undefined || slide === query.slide)
    },
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
