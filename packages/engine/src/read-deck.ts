import type { DeckId } from "@airdesign/catalog"
import { foldDesign, printDesign, readDeckId, shownDesign, themedDesign } from "@airdesign/catalog"
import {
  bytesOf,
  foldGrid,
  readSlideId,
  foldSlides,
  presentSlides,
  currentBox,
  currentValue,
  floorNodes,
  groupedNow,
  history,
  landedPatch,
  netPatch,
  openingElement,
  readElementId,
  shapeOf,
  slideKind,
  themeFonts,
  themeNode,
  themeSlots,
  version,
  type Box,
  type ElementLink,
  type ElementId,
  type NodeRegister,
  type Register,
  type IndexElement,
  type IndexSlide,
  type Kind,
  type Palette,
  type Role,
} from "@airdesign/document"

import type { Deck } from "./call.js"

export const readTokens = 8000

export type ReadElement = {
  readonly link?: ElementLink
  readonly node: ElementId
  readonly slide: string
  readonly value: string | null
  readonly kind?: Kind
  readonly grouped?: boolean
  readonly version: number
  readonly box?: Box | null
  readonly role?: Role
  readonly design?: string
  readonly closed?: true
}

export type ReadDeckAnswer = {
  readonly ok: true
  readonly revision: number
  readonly grid: { readonly starts: readonly string[] }
  readonly elements: readonly ReadElement[]
  readonly slides: readonly Pick<IndexSlide, "id" | "position" | "palette">[]
  readonly palettes?: readonly Palette[]
  readonly theme?: Readonly<Record<string, string>>
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

function foldedElement(register: Register, node: ElementId): IndexElement | undefined {
  const opening = openingElement(register, node)
  return opening === undefined ? undefined : { ...opening, grouped: groupedNow(register, node) }
}

function elementOf(
  node: ElementId,
  body: NodeRegister | undefined,
  runId: string | null,
  fonts: NonNullable<Palette["fonts"]>,
  indexed?: IndexElement,
): ReadElement {
  const box = (body === undefined ? null : currentBox(body)) ?? indexed?.box ?? null
  const own = slideKind(node) === "slide"
  const held = {
    node,
    slide: shapeOf(node).slide,
    value: own || body === undefined ? (indexed?.value ?? null) : currentValue(body),
    version: body === undefined ? 0 : version(body),
    ...(indexed === undefined
      ? own
        ? { kind: "slide" as const }
        : {}
      : { kind: indexed.kind, grouped: indexed.grouped }),
  }
  const withBox = box === null && indexed === undefined ? held : { ...held, box }
  const edited = body !== undefined && history(body).length > 0
  const typed = edited ? shownDesign(indexed?.design ?? {}, currentValue(body)) : indexed?.design
  const opening = indexed?.opening === undefined ? [] : [{ v: 1, patch: indexed.opening }]
  const rows = body === undefined ? [] : [{ v: 1, patch: landedPatch(body, "text") }]
  const design = foldDesign(typed, netPatch([...opening, ...rows]))
  const line = design === undefined ? "" : printDesign(themedDesign(design, fonts))
  const linkEdit = body === undefined ? undefined : landedPatch(body, "text").link?.target
  const link = typeof linkEdit === "object" ? linkEdit.set : indexed?.link
  const designed = {
    ...(link === undefined ? {} : { link }),
    ...withBox,
    ...(indexed?.role === undefined ? {} : { role: indexed.role }),
    ...(line === "" ? {} : { design: line }),
  }
  if (body === undefined || !closedTo(body, runId)) return designed
  return { ...designed, closed: true }
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
    if (slideKind(node) === "slide" && !registered.has(node) && openingElement(register, node)?.opening === undefined)
      continue
    nodes.push(node)
    listed.add(node)
  }
  for (const node of register.nodes) {
    if (node === themeNode || readElementId(node) === undefined || register.elements[node] === undefined) continue
    if (listed.has(node)) continue
    nodes.push(node)
    listed.add(node)
  }
  const removed = new Set<ElementId>()
  for (const command of register.order) {
    if (command.slide === "element-remove" || command.slide === "element-ungroup") removed.add(command.node)
    if (command.slide === "element-restore" || command.slide === "element-regroup") removed.delete(command.node)
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

type ReadHead = Pick<ReadDeckAnswer, "revision" | "grid" | "slides" | "palettes" | "theme" | "index">

function themeSet(register: Register): Readonly<Record<string, string>> {
  const body = register.nodes.includes(themeNode) ? register.elements[themeNode] : undefined
  const edits = body === undefined ? {} : (landedPatch(body, "text").theme ?? {})
  return Object.fromEntries(
    Object.entries(edits).flatMap(([field, edit]) => (typeof edit === "object" ? [[field, edit.set]] : [])),
  )
}

function themedHead(palettes: readonly Palette[] | undefined, set: Readonly<Record<string, string>>) {
  const slots = Object.fromEntries(themeSlots.flatMap((slot) => (set[slot] === undefined ? [] : [[slot, set[slot]]])))
  const fonts = Object.fromEntries(themeFonts.flatMap((font) => (set[font] === undefined ? [] : [[font, set[font]]])))
  const theme = Object.fromEntries(
    Object.entries(set).map(([field, value]) => [field, Object.hasOwn(slots, field) ? `#${value}` : value]),
  )
  return {
    ...(palettes === undefined
      ? {}
      : {
          palettes: palettes.map((each) => ({
            ...each,
            slots: { ...each.slots, ...slots },
            ...(each.fonts === undefined && Object.keys(fonts).length === 0
              ? {}
              : { fonts: { ...each.fonts, ...fonts } }),
          })),
        }),
    ...(Object.keys(theme).length === 0 ? {} : { theme }),
  }
}

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
  const palettes = new Map(
    (index?.slides ?? []).flatMap(({ id, palette }) => (palette === undefined ? [] : [[id, palette]])),
  )
  const slideOf = (id: string, position: number) => {
    const palette = palettes.get(id)
    return palette === undefined || palette === 0 ? { id, position } : { id, position, palette }
  }
  const themed = themedHead(index?.palettes, themeSet(deck.register))
  const fontsOf = (slide: string) => themed.palettes?.[palettes.get(slide) ?? 0]?.fonts ?? {}
  return packRead(
    {
      revision: deck.revision,
      grid: foldGrid({
        file:
          deck.register.file.length > 0
            ? deck.register.file
            : (index?.slides ?? []).flatMap((slide) => {
                const id = readSlideId(slide.id)
                return id === undefined ? [] : [id]
              }),
        order: deck.register.order,
      }).grid,
      slides:
        deck.register.order.length === 0
          ? (index?.slides ?? []).map(({ id, position }) => slideOf(id, position))
          : presentSlides(deck.register).map(({ id }, position) => slideOf(id, position)),
      ...themed,
      index: index === undefined ? "missing" : index.elements.length === index.total ? "ready" : "pending",
    },
    nodes,
    query.cursor === undefined ? 0 : firstAfter(nodes, query.cursor),
    (node) => {
      const slide = shapeOf(node).slide
      return !goneSlides.has(slide) && (query.slide === undefined || slide === query.slide)
    },
    (node) =>
      elementOf(
        node,
        deck.register.elements[node],
        query.runId,
        fontsOf(shapeOf(node).slide),
        foldedElement(deck.register, node),
      ),
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
