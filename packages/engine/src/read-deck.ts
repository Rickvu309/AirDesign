import type { DeckId } from "@airdesign/catalog"
import { foldDesign, printDesign, readDeckId, shownDesign, templateFontDesign } from "@airdesign/catalog"
import {
  slideGroups,
  bytesOf,
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
  slideBirths,
  templateFonts,
  templateStylesNode,
  templateStyleOwned,
  templateStyleNode,
  templateColors,
  textStylesOf,
  version,
  withCurrentKeys,
  type Box,
  type ElementLink,
  type ElementId,
  type NodeRegister,
  type Register,
  type IndexElement,
  type IndexSlide,
  type Kind,
  type Palette,
  type TemplateStyle,
  slideNode,
  type Role,
} from "@airdesign/document"

import type { Deck } from "./call.js"
import { framedElement, readFrames } from "./read-frames.js"
import { slideArrangement } from "./slide-arrangement-read.js"

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
  readonly frame?: "auto" | "free"
}

export type ReadTemplateStyle = TemplateStyle & {
  readonly node: ElementId
  readonly custom?: readonly { readonly name: string; readonly color: string }[]
}

export type ReadDeckAnswer = {
  readonly ok: true
  readonly revision: number
  readonly groups: readonly { readonly first: string }[]
  readonly elements: readonly ReadElement[]
  readonly slides: readonly Pick<
    IndexSlide,
    "id" | "position" | "palette" | "templateStyle" | "textStyles" | "skipped" | "transition" | "guides"
  >[]
  readonly templateStyles?: readonly ReadTemplateStyle[]
  readonly palettes?: readonly Palette[]
  readonly templateStyle?: Readonly<Record<string, string>>
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

function shownValue(value: string | null): string | null {
  return value === null ? null : withCurrentKeys(value)
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
    value: shownValue(own || body === undefined ? (indexed?.value ?? null) : currentValue(body)),
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
  const line = design === undefined ? "" : printDesign(templateFontDesign(design, fonts))
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
    if (templateStyleOwned(node) || readElementId(node) === undefined || register.elements[node] === undefined) continue
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

type ReadHead = Pick<
  ReadDeckAnswer,
  "revision" | "groups" | "slides" | "palettes" | "templateStyles" | "templateStyle" | "index"
>

function styleFields(register: Register, node = templateStylesNode): Readonly<Record<string, string>> {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  const edits = body === undefined ? {} : (landedPatch(body, "text").templateStyle ?? {})
  return Object.fromEntries(
    Object.entries(edits).flatMap(([field, edit]) =>
      typeof edit === "object" && typeof edit.set === "string" ? [[field, edit.set]] : [],
    ),
  )
}

function styleRemoved(register: Register, node: ElementId): boolean {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  if (body === undefined) return false
  const edit = landedPatch(body, "text").templateStyle?.removed
  return typeof edit === "object" && edit.set === true
}

function customColors(
  register: Register,
  node: ElementId,
): readonly { readonly name: string; readonly color: string }[] | undefined {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  if (body === undefined) return undefined
  const edit = landedPatch(body, "text").templateStyle?.custom
  if (typeof edit !== "object" || !Array.isArray(edit.set)) return undefined
  return edit.set.map((item) => ({ name: item.name, color: `#${item.color}` }))
}

function usedStyles(register: Register): ReadonlySet<string> {
  const bySlide = new Map<string, string>()
  for (const slide of register.index?.slides ?? []) {
    if (slide.templateStyle !== undefined) bySlide.set(slide.id, slide.templateStyle)
  }
  for (const node of register.nodes) {
    if (slideKind(node) !== "slide") continue
    const body = register.elements[node]
    const edit = body === undefined ? undefined : landedPatch(body, "text").templateStyle?.id
    if (typeof edit === "object") bySlide.set(shapeOf(node).slide, edit.set)
  }
  return new Set(bySlide.values())
}

function styledHead(palettes: readonly Palette[] | undefined, set: Readonly<Record<string, string>>) {
  const slots = Object.fromEntries(
    templateColors.flatMap((slot) => (set[slot] === undefined ? [] : [[slot, set[slot]]])),
  )
  const fonts = Object.fromEntries(
    templateFonts.flatMap((font) => (set[font] === undefined ? [] : [[font, set[font]]])),
  )
  const changed = Object.fromEntries(
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
    ...(Object.keys(changed).length === 0 ? {} : { templateStyle: changed }),
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
  const framed = readFrames(deck.register)
  const index = deck.register.index
  const used = usedStyles(deck.register)
  const templateStyles = index?.templateStyles?.flatMap((style, at) => {
    const node = templateStyleNode(at)
    if (styleRemoved(deck.register, node) && !used.has(style.id)) return []
    const scoped = styleFields(deck.register, node)
    const palette =
      styledHead([style.palette], { ...styleFields(deck.register), ...scoped }).palettes?.[0] ?? style.palette
    const custom = customColors(deck.register, node) ?? customColors(deck.register, templateStylesNode)
    return [
      {
        ...style,
        node,
        name: scoped.name ?? styleFields(deck.register).name ?? style.name,
        palette,
        ...(custom === undefined ? {} : { custom }),
      },
    ]
  })
  const palettes = new Map(
    (index?.slides ?? []).flatMap(({ id, palette }) => (palette === undefined ? [] : [[id, palette]])),
  )
  const textStyles = query.slide === undefined ? [] : textStylesOf(deck.register, query.slide)
  const skippedSources = new Set(index?.slides.filter((slide) => slide.skipped).map((slide) => slide.id))
  const clonedFrom = new Map(
    deck.register.order.flatMap((command) =>
      slideBirths(command).flatMap((birth) => (birth.slide === "clone" ? [[birth.id, birth.source] as const] : [])),
    ),
  )
  function originallySkipped(slide: ReturnType<typeof readSlideId>): boolean {
    if (slide === undefined) return false
    const source = clonedFrom.get(slide)
    return source === undefined ? skippedSources.has(slide) : originallySkipped(source)
  }
  const slideOf = (id: string, position: number) => {
    const styles = query.slide === id && textStyles.length > 0 ? { textStyles } : {}
    const palette = palettes.get(id)
    const slide = readSlideId(id)
    const node = slide === undefined ? undefined : slideNode(slide, "slide")
    const body = node === undefined ? undefined : deck.register.elements[node]
    const patch = body === undefined ? {} : landedPatch(body, "text")
    const rows = patch.templateStyle?.id
    const opening = node === undefined ? undefined : openingElement(deck.register, node)?.opening
    const shown = patch.show?.skipped
    const born = opening?.show?.skipped
    const skipped =
      typeof shown === "object" ? shown.set : typeof born === "object" ? born.set : originallySkipped(slide)
    const source = node === undefined ? undefined : openingElement(deck.register, node)?.opening?.templateStyle?.id
    const importedStyle = (slide: string): string | undefined => {
      const original = index?.slides.find((source) => source.id === slide)?.templateStyle
      if (original !== undefined) return original
      const command = deck.register.order.find(
        (command) => (command.slide === "add" || command.slide === "clone") && command.id === slide,
      )
      return command?.slide === "clone"
        ? importedStyle(command.source)
        : command?.slide === "add"
          ? importedStyle(command.layout)
          : undefined
    }
    const templateStyle =
      typeof rows === "object" ? rows.set : typeof source === "object" ? source.set : importedStyle(id)
    return {
      id,
      position,
      ...(skipped ? { skipped: true as const } : {}),
      ...styles,
      ...(palette === undefined || palette === 0 ? {} : { palette }),
      ...(templateStyle === undefined ? {} : { templateStyle }),
      ...slideArrangement(
        body,
        index?.slides.find((source) => source.id === id),
      ),
    }
  }
  const styled = styledHead(index?.palettes, styleFields(deck.register))
  if (templateStyles !== undefined) {
    const allPalettes: Palette[] = []
    const slides =
      deck.register.order.length === 0
        ? (index?.slides ?? [])
        : presentSlides(deck.register).map(({ id }, position) => ({ id, position }))
    for (const slide of slides) {
      const chosenStyle = templateStyles.find((style) => style.id === slideOf(slide.id, slide.position).templateStyle)
      const opening = index?.palettes?.[palettes.get(slide.id) ?? 0]
      const chosen = chosenStyle?.palette ?? opening
      if (chosen === undefined) continue
      const palette: Palette = { ...chosen, map: opening?.map ?? chosen.map }
      const found = allPalettes.findIndex((held) => JSON.stringify(held) === JSON.stringify(palette))
      palettes.set(slide.id, found < 0 ? allPalettes.length : found)
      if (found < 0) allPalettes.push(palette)
    }
    styled.palettes = allPalettes
  }
  const fontsOf = (slide: string) => styled.palettes?.[palettes.get(slide) ?? 0]?.fonts ?? {}
  return packRead(
    {
      revision: deck.revision,
      groups: slideGroups({
        ...deck.register,
        file:
          deck.register.file.length > 0
            ? deck.register.file
            : (index?.slides ?? []).flatMap((slide) => {
                const id = readSlideId(slide.id)
                return id === undefined ? [] : [id]
              }),
      }).map((group) => ({ first: group.slides[0] })),
      ...(templateStyles === undefined || query.cursor !== undefined ? {} : { templateStyles }),
      slides: (deck.register.order.length === 0
        ? (index?.slides ?? []).map(({ id, position }) => slideOf(id, position))
        : presentSlides(deck.register).map(({ id }, position) => slideOf(id, position))
      ).map((slide) => {
        if (query.cursor === undefined) return slide
        if (slide.templateStyle !== undefined)
          return {
            id: slide.id,
            position: slide.position,
            ...(slide.skipped ? { skipped: true as const } : {}),
            ...(slide.palette === undefined ? {} : { palette: slide.palette }),
          }
        if (slide.transition === undefined) return slide
        const { transition: _dropped, ...rest } = slide
        return rest
      }),
      ...styled,
      index: index === undefined ? "missing" : index.elements.length === index.total ? "ready" : "pending",
    },
    nodes,
    query.cursor === undefined ? 0 : firstAfter(nodes, query.cursor),
    (node) => {
      const slide = shapeOf(node).slide
      if (framed.backdrops.has(node)) return false
      return !goneSlides.has(slide) && (query.slide === undefined || slide === query.slide)
    },
    (node) => {
      const shown = (each: ElementId) =>
        elementOf(
          each,
          deck.register.elements[each],
          query.runId,
          fontsOf(shapeOf(each).slide),
          foldedElement(deck.register, each),
        )
      return framedElement(shown(node), framed, shown)
    },
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
