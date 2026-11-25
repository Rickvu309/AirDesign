import { linkedOwner } from "./component/instance-ownership.js"
import { componentSpec } from "./component/library.js"
import { deckOf } from "./deck-of.js"
import type { Doom, Node } from "./doom.js"
import { boxOf, childrenOf, parentOf, propOf, slidesOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import { placeholderTitle } from "./placeholder-title.js"
import { textArea } from "./preset-geometry.js"
import type { Box } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"
import { isStructuralTitle, isTitleLabel, normalizeTitle } from "./title-label.js"

const fixes = {
  "title-label": "State the slide’s takeaway in one sentence.",
  "title-long": "Cut the title to two lines at its current size, or split the slide.",
  "title-duplicate": "Give each slide a title that states its own takeaway.",
  "no-source": "Add a Source: line at the bottom left and name where the data came from.",
  "two-charts": "If the charts make different points, give each its own slide.",
  "many-bullets": "Keep the five most important bullets or split the list across slides.",
  "placeholder-text": "Replace the placeholder with the final text.",
  "pie-compare": "Use a bar chart to compare the shares on a common scale.",
  "empty-card": "Make the cards, or the row that holds them, only as tall as their words.",
} as const

export type SlideFinding = {
  readonly code: keyof typeof fixes
  readonly node: NodeId
  readonly slide: NodeId
  readonly note: string
}

const finding = (code: SlideFinding["code"], slide: NodeId, node = slide): SlideFinding => ({
  code,
  slide,
  node,
  note: fixes[code],
})

function shownLayers(doom: Doom, parent: NodeId): readonly Node[] {
  return childrenOf(doom, parent).flatMap((node) => {
    if (propOf(node, "hidden") === true || propOf(doom.nodes.get(parent), "instance")?.generated === node.id) return []
    return [node, ...shownLayers(doom, node.id)]
  })
}

const placeholder = /\b(?:tbd|lorem)\b|\bx%|\b00\.0%|\bxx(?=%|[kmb]n?\b)|[$€£¥]xx\b/i
const isPlaceholder = (text: string) =>
  text.trim().toLowerCase() === placeholderTitle.toLowerCase() || placeholder.test(text)

function slideTitle(layers: readonly Node[]) {
  const node = layers.find((layer) => propOf(layer, "role") === "title")
  const text = propOf(node, "text")
  if (node === undefined || text === undefined) return undefined
  const title = text.chars.trim()
  return title === "" ? undefined : { node, text, title }
}

type Title = NonNullable<ReturnType<typeof slideTitle>>

const bodyTitle = (title: Title | undefined) =>
  title === undefined || title.text.style === "display" || isStructuralTitle(title.title) ? undefined : title

type Measurement = {
  readonly measure: Measure
  readonly boxes?: ReadonlyMap<NodeId, Box>
  readonly unread?: ReadonlySet<NodeId>
}

function titleLines(doom: Doom, slide: NodeId, title: Title, measurement: Measurement): number | undefined {
  const { measure, boxes = solveLayout(doom, slide, measure), unread } = measurement
  if (unread?.has(title.node.id) === true) return undefined
  const box = boxes.get(title.node.id)
  if (box === undefined) return undefined
  const area = textArea(propOf(title.node, "geometry"), box.w, box.h)
  return measure(title.text, deckOf(doom).theme, area.w).lines.length
}

const dataValue = /^[(\-−+]?[$€£¥]?\d[\d,.]*\s*(?:%|x|[kmb]n?|pts?)?\)?$/i
const year = /^(?:19|20)\d{2}$/
const sourceLabel = /\bsources?\s*(?::|[-–]\s)/i

function dataGrid(doom: Doom, node: Node): boolean {
  if (propOf(node, "layout")?.mode !== "grid") return false
  return (
    childrenOf(doom, node.id).filter((cell) => {
      const text = propOf(cell, "text")?.chars.trim() ?? ""
      return propOf(cell, "hidden") !== true && dataValue.test(text) && !year.test(text)
    }).length >= 3
  )
}

function slideCharts(layers: readonly Node[], boxes?: ReadonlyMap<NodeId, Box>) {
  return layers.flatMap((node) => {
    const instance = propOf(node, "instance")
    const kind = instance === undefined ? undefined : componentSpec(instance.component.id)?.chart
    if (kind === undefined) return []
    const { w, h } = boxOf(node, boxes)
    return [{ kind, area: w * h }]
  })
}

const filledShare = 0.6

const painted = (node: Node) =>
  (propOf(node, "fills") ?? []).some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0)

function wordsShare(doom: Doom, card: Node, boxes: ReadonlyMap<NodeId, Box>): number {
  const layout = propOf(card, "layout")
  const kids = childrenOf(doom, card.id).filter((kid) => propOf(kid, "hidden") !== true)
  if (layout === undefined || layout.mode === "none" || kids.length === 0) return 1
  const placed = kids.map((kid) => boxOf(kid, boxes))
  const top = Math.min(...placed.map((box) => box.y))
  const end = Math.max(...placed.map((box) => box.y + box.h))
  return (end - top + layout.padding.t + layout.padding.b) / boxOf(card, boxes).h
}

function emptyCards(doom: Doom, layers: readonly Node[], boxes: ReadonlyMap<NodeId, Box>): readonly NodeId[] {
  const fullest = new Map<NodeId, number>()
  for (const card of layers) {
    const row = parentOf(card)?.id
    const mode = propOf(row === undefined ? undefined : doom.nodes.get(row), "layout")?.mode
    if (row === undefined || card.type !== "frame" || (mode !== "row" && mode !== "column") || !painted(card)) continue
    if (linkedOwner(doom.nodes, card.id) !== undefined) continue
    fullest.set(row, Math.max(fullest.get(row) ?? 0, wordsShare(doom, card, boxes)))
  }
  return [...fullest].flatMap(([row, share]) => (share < filledShare ? [row] : []))
}

function onSlide(
  doom: Doom,
  slide: NodeId,
  layers: readonly Node[],
  heading: Title | undefined,
  measurement?: Measurement,
) {
  const found: SlideFinding[] = []
  const title = bodyTitle(heading)
  if (title !== undefined) {
    if (isTitleLabel(title.title)) found.push(finding("title-label", slide, title.node.id))
    const lines = measurement === undefined ? undefined : titleLines(doom, slide, title, measurement)
    if (lines === undefined ? title.title.split(/\s+/).length > 25 : lines > 2)
      found.push(finding("title-long", slide, title.node.id))
  }
  if (measurement !== undefined) {
    const boxes = measurement.boxes ?? solveLayout(doom, slide, measurement.measure)
    for (const row of emptyCards(doom, layers, boxes)) found.push(finding("empty-card", slide, row))
  }
  const charts = slideCharts(layers, measurement?.boxes)
  const texts = layers.flatMap((node) => {
    const text = propOf(node, "text")
    return text === undefined ? [] : [{ node: node.id, text }]
  })
  if (
    (charts.length > 0 || layers.some((node) => dataGrid(doom, node))) &&
    !texts.some(({ text }) => sourceLabel.test(text.chars))
  )
    found.push(finding("no-source", slide))
  const largest = Math.max(...charts.map(({ area }) => area))
  if (charts.filter(({ kind }) => kind === "pie").length > 1) found.push(finding("pie-compare", slide))
  else if (charts.filter(({ area }) => area >= largest / 4).length > 1) found.push(finding("two-charts", slide))
  const structural = heading !== undefined && isStructuralTitle(heading.title)
  for (const { node, text } of texts) {
    if (!structural && text.paras.filter((para) => para.list === "bullet" && (para.level ?? 0) === 0).length > 5)
      found.push(finding("many-bullets", slide, node))
    if (isPlaceholder(text.chars)) found.push(finding("placeholder-text", slide, node))
  }
  return found
}

export function slideFindings(
  doom: Doom,
  slides: readonly NodeId[],
  measurement?: Measurement,
): readonly SlideFinding[] {
  if (slides.length === 0) return []
  const titles = new Map<string, SlideFinding[]>()
  const found: SlideFinding[] = []
  const selected = new Set(slides)
  for (const slide of slidesOf(doom)) {
    const { id } = slide
    if (propOf(slide, "hidden") === true) continue
    const layers = shownLayers(doom, id)
    const heading = slideTitle(layers)
    if (selected.has(id)) found.push(...onSlide(doom, id, layers, heading, measurement))
    const title = bodyTitle(heading)
    if (title === undefined || isPlaceholder(title.title)) continue
    const key = normalizeTitle(title.title)
    const same = titles.get(key) ?? []
    same.push(finding("title-duplicate", id, title.node.id))
    titles.set(key, same)
  }
  for (const same of titles.values()) {
    if (same.length > 1) found.push(...same.filter(({ slide }) => selected.has(slide)))
  }
  return found
}
