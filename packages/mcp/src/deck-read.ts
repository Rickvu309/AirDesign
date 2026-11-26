import * as doom from "@airdesign/doom"

import { answered, refused, type ToolResult } from "./answer.js"
import type { Opened } from "./deck-host.js"
import { type Laid, listed, readFindingsNote } from "./layout-findings-answer.js"

const readBytes = 24_000

function themeOf(fold: doom.Doom) {
  const { colors, fonts, textStyles } = doom.deckOf(fold).theme
  const sizes = Object.fromEntries(Object.entries(textStyles).map(([name, style]) => [name, style.size]))
  return { colors, fonts, sizes }
}

const lead = (opened: Opened, count: number) =>
  `Deck ${opened.deck} "${doom.deckName(opened.fold)}"${doom.deckNameFollows(opened.fold) ? " (nameFollows: named by slide 1's title)" : ""} at rev ${String(opened.rev)}, ${String(count)} slides. Change it with airdesign_execute.`

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
  const note = `${String(lines.length)} layers in deck ${opened.deck} at rev ${String(opened.rev)} hold "${find}"; each line starts with its slide id.${more}`
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

export function readAnswer(opened: Opened, query: Query, laid?: Laid): ToolResult {
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
    ...(doom.deckOf(opened.fold).language === undefined ? {} : { language: doom.deckOf(opened.fold).language }),
    ...found,
  }
  const note = [lead(opened, slides.length), ...(laid === undefined ? [] : readFindingsNote(laid))].join(" ")
  return answered(note, {
    ...answer,
    layers: doom.readForAgent(opened.fold, chosen, laid?.boxes, detail),
  })
}
