import type { PatternItem, WireDiagram } from "@airdesign/catalog"
import {
  groupOf,
  nextElementId,
  slideMeasure,
  textStylesOf,
  type Box,
  type ElementId,
  type SlideId,
} from "@airdesign/document"
import { decided, ready } from "./agent-elements.js"
import type { Applied } from "./apply-change.js"
import type { Deck } from "./call.js"
import { layer, Overflowed, padded, Refused, set, textLayer, wrap, type Build } from "./pattern-build.js"
import { fittedSize, linesHigh, tones, typeScale, typeSteps, type Line } from "./pattern-type.js"

const point = 12_700

type Part = readonly Line[]

type Column = { readonly nodes: readonly ElementId[]; readonly high: number }

function column(build: Build, x: number, y: number, width: number, parts: readonly Part[]): Column {
  const nodes: ElementId[] = []
  const step = Math.round(build.scale.gap / 2)
  let top = y
  for (const lines of parts.filter((part) => part.length > 0)) {
    const high = Math.round(linesHigh(lines, build.scale, width))
    nodes.push(textLayer(build, { x, y: top, cx: width, cy: high }, lines))
    top += high + step
  }
  return { nodes, high: Math.max(0, top - y - step) }
}

function slots(area: Box, count: number, gap: number): readonly Box[] {
  const width = Math.floor((area.cx - gap * (count - 1)) / count)
  return Array.from({ length: count }, (_, at) => ({
    x: area.x + at * (width + gap),
    y: area.y,
    cx: width,
    cy: area.cy,
  }))
}

type Card = { readonly frame: ElementId; readonly children: readonly ElementId[]; readonly high: number }

function card(build: Build, box: Box, parts: readonly Part[], fill = tones.card, icon?: string): Card {
  const { pad, gap } = build.scale
  const inner = box.cx - pad * 2
  const top = icon === undefined ? [] : [iconLayer(build, box.x + pad, box.y + pad, icon)]
  const offset = top.length === 0 ? 0 : Math.round(pad * 2.2)
  const texts = column(build, box.x + pad, box.y + pad + offset, inner, parts)
  const frame = wrap(build, [...top, ...texts.nodes])
  set(build, frame, {
    layout: { flow: "vertical", gap: Math.round(gap / 2), padding: padded(pad), align: "topLeft" },
    fills: { paint: { solid: fill } },
    geometry: { corners: Math.round(pad / 2) },
  } as never)
  return { frame, children: texts.nodes, high: pad * 2 + offset + texts.high }
}

function iconLayer(build: Build, x: number, y: number, icon: string): ElementId {
  const side = Math.round(build.scale.pad * 1.7)
  return layer(build, "shape", { x, y, cx: side, cy: side }, null, {
    fills: { p0: { set: { image: true } }, source: { set: icon }, color: { set: tones.accent } },
  })
}

function row(
  build: Build,
  area: Box,
  cards: readonly Card[],
  flow: "horizontal" | "vertical" = "horizontal",
  filled = false,
): Card {
  const frame = wrap(
    build,
    cards.map((each) => each.frame),
  )
  const { gap } = build.scale
  const tallest = Math.max(...cards.map((each) => each.high))
  const stacked = cards.reduce((sum, each) => sum + each.high, 0) + gap * (cards.length - 1)
  const needed = flow === "horizontal" ? tallest : stacked
  if (needed > area.cy) throw new Overflowed()
  const high = filled ? area.cy : needed
  set(build, frame, {
    layout: { flow, gap, padding: padded(0), align: "topLeft", width: "fixed", height: "fixed" },
    box: { x: area.x, y: area.y, w: area.cx, h: high },
  } as never)
  for (const each of cards) {
    set(build, each.frame, { layout: { width: "fill", height: "fill" } } as never)
    for (const child of each.children) set(build, child, { layout: { width: "fill" } } as never)
  }
  return { frame, children: [], high }
}

const points = (item: PatternItem): Part =>
  (item.points ?? []).map((text) => ({ text, role: "body", bullet: true }) as const)

function kpi(build: Build, area: Box, items: readonly PatternItem[]): void {
  const { scale } = build
  const boxes = slots(area, items.length, scale.gap)
  const inner = (boxes[0]?.cx ?? area.cx) - scale.pad * 2
  const number = fittedSize(
    items.map((item) => item.value ?? ""),
    inner,
    scale.number,
    scale.heading,
  )
  const cards = items.map((item, at) =>
    card(build, boxes[at] ?? area, [
      item.title === undefined ? [] : [{ text: item.title, role: "label", upper: true }],
      [{ text: item.value ?? "", role: "number", size: number }],
      item.note === undefined ? [] : [{ text: item.note, role: "caption" }],
    ]),
  )
  row(build, area, cards)
}

function cards(build: Build, area: Box, items: readonly PatternItem[]): void {
  const boxes = slots(area, items.length, build.scale.gap)
  const built = items.map((item, at) =>
    card(
      build,
      boxes[at] ?? area,
      [item.title === undefined ? [] : [{ text: item.title, role: "heading" }], points(item)],
      tones.card,
      item.icon,
    ),
  )
  row(build, area, built, "horizontal", true)
}

function compare(build: Build, area: Box, items: readonly PatternItem[]): void {
  const boxes = slots(area, items.length, build.scale.gap * 2)
  const built = items.map((item, at) =>
    card(
      build,
      boxes[at] ?? area,
      [item.title === undefined ? [] : [{ text: item.title, role: "heading", color: tones.accent }], points(item)],
      tones.card,
    ),
  )
  row(build, area, built, "horizontal", true)
}

function grouped(build: Build, nodes: readonly ElementId[]): void {
  const measure = slideMeasure(build.register, build.slide)
  if (measure === undefined) throw new Refused("dead")
  const group = groupOf(build.register, build.slide, nextElementId(build.register, build.slide, measure.free), nodes)
  if (group === null) return
  const done = decided(build.register, build.file, { ...group, runId: build.runId }, build.runId)
  if (!done.ok) throw new Refused(done.refusal)
  build.register = done.register
}

function matrix(build: Build, area: Box, items: readonly PatternItem[], axes?: readonly string[]): void {
  const { gap } = build.scale
  const strip = axes === undefined ? 0 : Math.round((build.scale.label / 100) * point * 2.6)
  const tall = area.cy - strip
  const half = Math.floor((tall - gap) / 2)
  const wide = Math.min(Math.floor((area.cx - strip - gap) / 2), Math.round(half * 1.6))
  const grid = { x: area.x + strip, y: area.y, cx: wide * 2 + gap, cy: tall }
  const bands = [0, 1].map((line) => {
    const band = { x: grid.x, y: grid.y + line * (half + gap), cx: grid.cx, cy: half }
    const boxes = slots(band, 2, gap)
    const built = [0, 1].map((side) => {
      const item = items[line * 2 + side] ?? {}
      const lead = line === 0 && side === 1
      const ink = lead ? tones.paper : undefined
      return card(
        build,
        boxes[side] ?? band,
        [
          item.title === undefined
            ? []
            : [{ text: item.title, role: "heading", ...(ink === undefined ? {} : { color: ink }) }],
          (item.points ?? []).map(
            (text) => ({ text, role: "body", bullet: true, ...(ink === undefined ? {} : { color: ink }) }) as const,
          ),
        ],
        lead ? tones.accent : tones.card,
      )
    })
    return row(build, band, built, "horizontal", true)
  })
  const quadrants = row(build, grid, bands, "vertical", true).frame
  if (axes === undefined) return
  const [across, up] = axes
  const title = (text: string | undefined): Part =>
    text === undefined ? [] : [{ text, role: "label", upper: true, center: true }]
  const x = textLayer(
    build,
    { x: grid.x, y: grid.y + grid.cy + Math.round(gap / 3), cx: grid.cx, cy: strip - Math.round(gap / 3) },
    title(across),
  )
  const y = textLayer(build, { x: area.x, y: grid.y, cx: strip, cy: grid.cy }, title(up), "vert270")
  grouped(build, [quadrants, x, y])
}

function timeline(build: Build, area: Box, items: readonly PatternItem[]): void {
  const { gap } = build.scale
  const boxes = slots(area, items.length, gap)
  const dot = Math.round(build.scale.pad * 0.7)
  const columns = items.map((item, at) => {
    const box = boxes[at] ?? area
    const marker = layer(build, "shape", { x: box.x, y: box.y, cx: dot, cy: dot }, "")
    set(build, marker, {
      geometry: { shape: { preset: "ellipse", adjust: {} } },
      fills: { paint: { solid: tones.accent } },
    } as never)
    const texts = column(build, box.x, box.y + dot + gap, box.cx, [
      [{ text: item.value ?? "", role: "label", upper: true, color: tones.accent }],
      item.title === undefined ? [] : [{ text: item.title, role: "heading" }],
      item.note === undefined ? [] : [{ text: item.note, role: "caption" }],
    ])
    const frame = wrap(build, [marker, ...texts.nodes])
    set(build, frame, {
      layout: { flow: "vertical", gap: Math.round(gap / 2), padding: padded(0), align: "topLeft" },
    } as never)
    return { frame, children: texts.nodes, high: dot + gap + texts.high }
  })
  const lane = row(build, area, columns).frame
  const line = layer(
    build,
    "connector",
    {
      x: area.x + Math.round(dot / 2),
      y: area.y + Math.round(dot / 2),
      cx: (boxes.at(-1)?.x ?? area.x) - area.x,
      cy: 0,
    },
    null,
    {},
    "line",
  )
  set(build, line, { border: { fill: { solid: tones.accent }, width: 19_050 } } as never)
  grouped(build, [line, lane])
}

const patterns = { kpi, cards, compare, matrix, timeline } as const

export function applyPattern(deck: Deck, change: WireDiagram, area: Box, runId: string, base: number): Applied {
  const { slide } = change
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(deck.register, slide)
  if (measure?.size === undefined) return { ok: false, refusal: "dead" }
  const styles = textStylesOf(deck.register, slide)
  const draw = patterns[change.pattern as keyof typeof patterns]
  if (draw === undefined) return { ok: false, refusal: "dead" }
  for (const step of typeSteps) {
    const build: Build = {
      register: deck.register,
      file: opened.file,
      slide: slide as SlideId,
      runId,
      scale: typeScale(measure.size, styles, step),
    }
    try {
      draw(build, area, change.items ?? [], change.labels)
      return { ok: true, register: build.register }
    } catch (error) {
      if (error instanceof Refused) return { ok: false, refusal: error.refusal }
      if (!(error instanceof Overflowed)) throw error
    }
  }
  return { ok: false, refusal: "limit" }
}
