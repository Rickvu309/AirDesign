import { readDeckQueryFor, readNamedDeck } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { answered, hostRefused, refused, told, type ToolImage, type ToolResult } from "./answer.js"
import { componentFindings, componentFindingsNote, componentSignature } from "./component-answer.js"
import { deckMeasure } from "./deck-measure.js"
import type { DeckHost, Opened } from "./deck-host.js"
import { type Laid, layoutOf, listed, readFindingsNote } from "./layout-answer.js"
import { withOtherRuns } from "./other-runs.js"

const readBytes = 24_000
const picturesPerRead = 10

const pictureWords = {
  none: (slides: readonly string[], rev: number) =>
    `No current picture of ${slides.length === 1 ? "slide" : "slides"} ${slides.join(", ")} at rev ${String(rev)} yet. The owner's open AirDesign tab paints a slide a moment after it changes and none has sent it. Read again in a few seconds, or ask the owner to open the deck.`,
  fonts: (slides: readonly string[]) =>
    `A font couldn’t load for ${slides.length === 1 ? "slide" : "slides"} ${slides.join(", ")}. Read again when the fonts are available.`,
  more: (shown: number, total: number) =>
    `Pictures of the first ${String(shown)} of ${String(total)} slides. Read with slide and picture for another.`,
} as const

async function withPictures(read: ToolResult, opened: Opened, slides: readonly doom.NodeId[], host: DeckHost) {
  const wanted = slides.slice(0, picturesPerRead)
  const shots = await host.pictures?.(opened.deck, opened.fold, wanted)
  const images: ToolImage[] = []
  const pictures: string[] = []
  const waiting: string[] = []
  const fontFailures: string[] = []
  for (const id of wanted) {
    const data = shots?.get(id)
    if (data === undefined) {
      waiting.push(id)
      continue
    }
    if (typeof data !== "string") {
      fontFailures.push(id)
      continue
    }
    images.push({ type: "image", data, mimeType: "image/jpeg" })
    pictures.push(id)
  }
  const note = [
    read.answer.note,
    ...(fontFailures.length > 0 ? [pictureWords.fonts(fontFailures)] : []),
    ...(waiting.length > 0 ? [pictureWords.none(waiting, opened.rev)] : []),
    ...(slides.length > wanted.length ? [pictureWords.more(wanted.length, slides.length)] : []),
  ].join(" ")
  const result = told(true, {
    ...read.answer,
    note,
    ...(pictures.length === 0 ? {} : { pictures }),
    ...(fontFailures.length === 0
      ? {}
      : { pictureFailures: fontFailures.map((slide) => ({ slide, reason: "fonts" })) }),
  })
  return { ...result, content: [...images, ...result.content] }
}

function themeOf(fold: doom.Doom) {
  const { colors, fonts, textStyles } = doom.deckOf(fold).theme
  const sizes = Object.fromEntries(Object.entries(textStyles).map(([name, style]) => [name, style.size]))
  return { colors, fonts, sizes }
}

const lead = (opened: Opened, count: number) =>
  `Deck ${opened.deck} "${doom.deckName(opened.fold)}"${doom.deckNameFollows(opened.fold) ? " (nameFollows: named by slide 1's title)" : ""} at rev ${String(opened.rev)}, ${String(count)} slides. Send rev as base to airdesign_edit_deck.`

const foundLimit = 400

function foundAnswer(opened: Opened, find: string, detail: doom.NodeId | undefined): ToolResult {
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const wanted = find.toLowerCase()
  const lines = slides.flatMap((slide) =>
    doom
      .readForAgent(opened.fold, [slide], undefined, detail)
      .split("\n")
      .slice(1)
      .filter((line) => line.toLowerCase().includes(wanted))
      .map((line) => `${slide} ${line.trim()}`),
  )
  const shown = lines.slice(0, foundLimit)
  const more = lines.length > shown.length ? ` The first ${String(shown.length)} are listed: narrow the words.` : ""
  const note = `${String(lines.length)} layers in deck ${opened.deck} at rev ${String(opened.rev)} hold "${find}"; each line starts with its slide id.${more} Send rev as base to airdesign_edit_deck.`
  return answered(note, {
    ok: true,
    deck: opened.deck,
    rev: opened.rev,
    name: doom.deckName(opened.fold),
    slides,
    found: lines.length,
    layers: shown.join("\n"),
  })
}

type Query = {
  readonly detail?: string | undefined
  readonly slide?: string | undefined
  readonly cursor?: string | undefined
  readonly find?: string | undefined
  readonly component?: string | undefined
}

type Chosen =
  | { readonly ok: true; readonly chosen: readonly doom.NodeId[]; readonly next: doom.NodeId | undefined }
  | { readonly ok: false; readonly result: ToolResult }

function chosenSlides(opened: Opened, query: Query): Chosen {
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const detail = doom.readNodeId(query.detail)
  const detailSlide = detail === undefined ? undefined : doom.slideOf(opened.fold, detail)
  if (query.detail !== undefined && detailSlide === undefined)
    return { ok: false, result: refused("dead", { node: query.detail }) }
  const { slide = detailSlide, cursor } = query
  const alone = slide === undefined ? undefined : slides.find((id) => id === slide)
  if (slide !== undefined && alone === undefined) return { ok: false, result: refused("dead", { node: slide }) }
  const from = cursor === undefined ? 0 : slides.findIndex((id) => id === cursor)
  if (cursor !== undefined && from < 0) return { ok: false, result: refused("dead", { node: cursor }) }
  const wanted = alone === undefined ? slides.slice(from) : [alone]
  const chosen: doom.NodeId[] = []
  let bytes = 0
  for (const slide of wanted) {
    bytes += doom.readForAgent(opened.fold, [slide], undefined, detail).length
    if (chosen.length > 0 && bytes > readBytes) break
    chosen.push(slide)
  }
  return { ok: true, chosen, next: wanted[chosen.length] }
}

export function readAnswer(
  opened: Opened,
  query: Query,
  laid?: Laid,
  linkedComponents = doom.linkedComponentsEnabled,
): ToolResult {
  const detail = doom.readNodeId(query.detail)
  if (query.find !== undefined) return foundAnswer(opened, query.find, detail)
  const picked = chosenSlides(opened, query)
  if (!picked.ok) return picked.result
  const { chosen, next } = picked
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const found = laid === undefined || laid.findings.length === 0 ? {} : { findings: listed(laid.findings) }
  const answer = {
    ok: true,
    deck: opened.deck,
    rev: opened.rev,
    name: doom.deckName(opened.fold),
    slides,
    ...(next === undefined ? {} : { next }),
    theme: themeOf(opened.fold),
    ...found,
  }
  const components = linkedComponents ? [...doom.componentLibrary.keys()] : []
  const note = [
    lead(opened, slides.length),
    ...(components.length === 0
      ? []
      : ["Read with component to see a template's sample or detail for a placed instance."]),
    ...(laid === undefined ? [] : readFindingsNote(laid)),
  ].join(" ")
  return answered(note, {
    ...answer,
    ...(components.length === 0 ? {} : { components }),
    layers: doom.readForAgent(opened.fold, chosen, laid?.boxes, detail),
  })
}

async function laidRead(opened: Opened, query: Query, host: DeckHost): Promise<Laid | undefined> {
  if (query.find !== undefined) return undefined
  const picked = chosenSlides(opened, query)
  return picked.ok ? layoutOf(host, opened.fold, () => picked.chosen) : undefined
}

async function componentRead(opened: Opened, query: Query, host: DeckHost): Promise<ToolResult | undefined> {
  if (query.component !== undefined) {
    if (!doom.linkedComponentsEnabled) return undefined
    const signature = componentSignature(query.component)
    if (signature === undefined)
      return refused("dead", { field: "component", note: "Read the deck for available template ids." })
    return answered(
      `Template ${signature.id} r${signature.revision}. Add kind component with this id, or set data, variant and tokens on an instance.`,
      {
        ok: true,
        deck: opened.deck,
        rev: opened.rev,
        signature,
      },
    )
  }
  if (query.find !== undefined) return undefined
  const id = doom.readNodeId(query.detail)
  if (id === undefined) return undefined
  const node = opened.fold.nodes.get(id)
  if (node?.type !== "frame" || node.instance === undefined) return undefined
  const slide = doom.slideOf(opened.fold, id)
  if (slide === undefined || (query.slide !== undefined && query.slide !== slide)) return refused("dead", { node: id })
  const { component, data, tokens, variant, focus, parts, suppressed } = node.instance
  const signature = componentSignature(component.id)
  const layers = parts.map(({ node }) => node)
  const measured = await deckMeasure(host, [opened.fold], layers)
  const findings = componentFindings(opened.fold, [id], measured?.measure)
  const note = [
    `${id} component ${component.id} r${component.revision} on slide ${slide}, at rev ${opened.rev}.`,
    "Use a slide read for layer ids, or send this rev as base to edit the instance.",
    ...componentFindingsNote(findings),
  ].join(" ")
  return answered(note, {
    ok: true,
    deck: opened.deck,
    rev: opened.rev,
    instance: {
      id,
      slide,
      component,
      box: node.box,
      data,
      focus,
      tokens,
      variant: { ...signature?.defaultVariant, ...variant },
      parts: parts.length,
      suppressed: suppressed.length,
    },
    signature,
    findings,
  })
}

export async function readDeckTool(
  raw: unknown,
  agent: string,
  host: DeckHost,
  components: boolean,
): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readDeckQueryFor(components)(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const query = { ...parsed, component: typeof parsed.component === "string" ? parsed.component : undefined }
  const component = components ? await componentRead(opened, query, host) : undefined
  const read = withOtherRuns(
    component ?? readAnswer(opened, query, await laidRead(opened, query, host), components),
    opened.fold,
    agent,
  )
  if (parsed.picture !== true || !read.ok || parsed.find !== undefined || parsed.component !== undefined) return read
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const detail = doom.readNodeId(parsed.detail)
  const slide = parsed.slide ?? (detail === undefined ? undefined : doom.slideOf(opened.fold, detail))
  const from = parsed.cursor === undefined ? 0 : slides.findIndex((id) => id === parsed.cursor)
  const wanted = slide === undefined ? slides.slice(from) : slides.filter((id) => id === slide)
  return withPictures(read, opened, wanted, host)
}
