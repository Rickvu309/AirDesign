import { deckOf } from "./deck-of.js"
import type { Doom, Node } from "./doom.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import { placeholderTitle } from "./placeholder-title.js"
import { textArea } from "./preset-geometry.js"
import type { Box } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"
import { isTitleLabel } from "./title-label.js"

const fixes = {
  "title-label": "State the slide’s takeaway in one sentence.",
  "title-long": "Shorten the takeaway to 15 words and fit it on two lines at the current size.",
  "title-duplicate": "Give each slide a title that states its own takeaway.",
  "no-source": "Add a Source: line at the bottom left and name where the data came from.",
  "two-charts": "Give each chart its own slide and state its takeaway in the title.",
  "many-bullets": "Keep the five most important bullets or split the list across slides.",
  "placeholder-text": "Replace the placeholder with the final text.",
  "pie-compare": "Use one 100% stacked column chart to compare the shares.",
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

const sectionTitle = /^(?:agenda|table of contents|contents|section (?:\d+|[ivxlcdm]+)(?:\s*[:.\-–—].*)?)$/i
const placeholder = /\b(?:xx|tbd|lorem)\b|\bx%|\b00\.0%/i
const isPlaceholder = (text: string) =>
  text.trim().toLowerCase() === placeholderTitle.toLowerCase() || placeholder.test(text)
const normalized = (text: string) => text.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase()

function bodyTitle(layers: readonly Node[]) {
  const node = layers.find((layer) => propOf(layer, "role") === "title")
  const text = propOf(node, "text")
  if (node === undefined || text === undefined || text.style === "display") return undefined
  const title = text.chars.trim()
  return title === "" || sectionTitle.test(title) ? undefined : { node, text, title }
}

type Measurement = {
  readonly measure: Measure
  readonly boxes?: ReadonlyMap<NodeId, Box>
  readonly unread?: ReadonlySet<NodeId>
}

type Title = NonNullable<ReturnType<typeof bodyTitle>>

function titleLines(doom: Doom, slide: NodeId, title: Title, measurement: Measurement): number {
  const { measure, boxes = solveLayout(doom, slide, measure), unread } = measurement
  if (unread?.has(title.node.id) === true) return 0
  const box = boxes.get(title.node.id)
  if (box === undefined) return 0
  const area = textArea(propOf(title.node, "geometry"), box.w, box.h)
  return measure(title.text, deckOf(doom).theme, area.w).lines.length
}

function dataGrid(doom: Doom, node: Node): boolean {
  if (propOf(node, "layout")?.mode !== "grid") return false
  return (
    childrenOf(doom, node.id).filter(
      (cell) => propOf(cell, "hidden") !== true && /\d/.test(propOf(cell, "text")?.chars ?? ""),
    ).length >= 3
  )
}

const componentCharts: ReadonlySet<string> = new Set(["column"])
const chartKinds = (layers: readonly Node[]) =>
  layers.flatMap((node) => {
    const chart = propOf(node, "chart")
    if (chart !== undefined) return [chart.kind]
    const instance = propOf(node, "instance")
    return instance !== undefined && componentCharts.has(instance.component.id) ? [instance.component.id] : []
  })

function onSlide(
  doom: Doom,
  slide: NodeId,
  layers: readonly Node[],
  title: ReturnType<typeof bodyTitle>,
  measurement?: Measurement,
) {
  const found: SlideFinding[] = []
  if (title !== undefined) {
    if (isTitleLabel(title.title)) found.push(finding("title-label", slide, title.node.id))
    if (
      title.title.split(/\s+/).length > 15 ||
      (measurement !== undefined && titleLines(doom, slide, title, measurement) > 2)
    )
      found.push(finding("title-long", slide, title.node.id))
  }
  const charts = chartKinds(layers)
  const texts = layers.flatMap((node) => {
    const text = propOf(node, "text")
    return text === undefined ? [] : [{ node: node.id, text }]
  })
  if (
    (charts.length > 0 || layers.some((node) => dataGrid(doom, node))) &&
    !texts.some(({ text }) => /^sources?:/i.test(text.chars.trimStart()))
  )
    found.push(finding("no-source", slide))
  if (charts.length > 1) found.push(finding("two-charts", slide))
  if (charts.filter((kind) => kind === "pie").length > 1) found.push(finding("pie-compare", slide))
  for (const { node, text } of texts) {
    if (text.paras.filter((para) => para.list === "bullet" && (para.level ?? 0) === 0).length > 5)
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
    const title = bodyTitle(layers)
    if (selected.has(id)) found.push(...onSlide(doom, id, layers, title, measurement))
    if (title === undefined || isPlaceholder(title.title)) continue
    const key = normalized(title.title)
    const same = titles.get(key) ?? []
    same.push(finding("title-duplicate", id, title.node.id))
    titles.set(key, same)
  }
  for (const same of titles.values()) {
    if (same.length > 1) found.push(...same.filter(({ slide }) => selected.has(slide)))
  }
  return found
}
