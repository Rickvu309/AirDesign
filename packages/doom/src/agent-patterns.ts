import type { AgentChange, PatternName } from "./agent-change.js"
import type { AgentItem } from "./agent-item.js"
import { type Draft, type Values, stop } from "./agent-draft.js"
import { iconName, sidesOf, solid, surfaceOf, turnOf } from "./agent-look.js"
import { wrapRotation } from "./angle.js"
import { type Area, gapFor, padFor, patternArea, slideSize, themeOf } from "./agent-place.js"
import type { Px } from "./paint.js"
import {
  type Block,
  type Part,
  type Sized,
  type Styles,
  bullets,
  cardOf,
  emit,
  frameOf,
  heightIn,
  ladderOf,
  largestFitting,
  partOf,
  sizedPart,
  stylesAt,
} from "./pattern-parts.js"
import { borrowing, endsInside } from "./pattern-lend.js"
import { type Build, type Scale, boxIn, slotWidth, spreadDown, strokeOf, wordsFit, wordsOf } from "./pattern-scale.js"
import { timeline, timelineAcross } from "./pattern-timeline.js"
import type { Node } from "./doom.js"
import type { Text, TextStyleName } from "./text.js"
import { widestLine, widestWhole } from "./text-estimate.js"
import { zeroBox } from "./doom-walk.js"
import type { Theme } from "./theme.js"

type Add = Extract<AgentChange, { op: "add" }>
type Way = { readonly build: Build; readonly stepping: boolean }

const counts: Readonly<Record<PatternName, readonly [number, number]>> = {
  kpi: [1, 6],
  cards: [1, 5],
  compare: [2, 3],
  matrix: [1, 4],
  timeline: [2, 8],
  flow: [2, 6],
}
const names: Readonly<Record<PatternName, string>> = {
  kpi: "KPI",
  cards: "Cards",
  compare: "Compare",
  matrix: "Matrix",
  timeline: "Timeline",
  flow: "Flow",
}
const iconShare = 1.7
const axisShare = 2.6
const arrowRoom = 48
const flowWidthShare = 0.46
const connectorWeight = 3

function rowOf(area: Area, cards: readonly Sized[], gap: Px, root: Values): Block | undefined {
  const tallest = Math.max(...cards.map((card) => card.high))
  if (tallest > area.h) return undefined
  return frameOf(
    {
      ...root,
      box: boxIn(area, tallest),
      sizing: { w: "fixed", h: "hug" },
      layout: { mode: "row", gap, padding: sidesOf(0), align: "top-left" },
    },
    cards.map((card) => card.block),
  )
}

function iconOf(name: string, side: Px): Sized {
  return {
    high: side,
    block: {
      type: "shape",
      values: {
        box: { ...zeroBox, w: side, h: side },
        geometry: { kind: "icon", name: iconName(name) },
        strokes: [solid("accent1")],
        stroke: strokeOf(Math.max(2, Math.round(side / 12))),
      },
    },
  }
}

function numberStyle(theme: Theme, start: TextStyleName, values: readonly string[], room: Px): TextStyleName {
  const ladder = ladderOf(theme)
  const from = Math.max(0, ladder.indexOf(start))
  return ladder.slice(from).find((style) => widestLine(values, theme, style) <= room) ?? ladder[ladder.length - 1]!
}

const kpi: Build = (area, items, scale) => {
  const { gap, pad, theme, styles } = scale
  const room = slotWidth(area, items.length, gap) - pad * 2
  const number = numberStyle(
    theme,
    styles.number,
    items.map((item) => item.value ?? ""),
    room,
  )
  const cards = items.map((item) =>
    cardOf(
      [
        ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.label, "text2"), theme, room)]),
        ...(item.value === undefined ? [] : [sizedPart(partOf(item.value, number), theme, room)]),
        ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2"), theme, room)]),
      ],
      { pad, gap, fill: "background2" },
    ),
  )
  return rowOf(area, cards, gap, scale.root)
}

function cardsLike(spacing: number, headingColor: "text" | "accent1", icons: boolean): Build {
  return (area, items, scale) => {
    const { pad, theme, styles } = scale
    const gap = scale.gap * spacing
    const room = slotWidth(area, items.length, gap) - pad * 2
    const cards = items.map((item) =>
      cardOf(
        [
          ...(icons && item.icon !== undefined ? [iconOf(item.icon, Math.round(pad * iconShare))] : []),
          ...(item.title === undefined
            ? []
            : [sizedPart(partOf(item.title, styles.heading, headingColor), theme, room)]),
          ...(item.points === undefined ? [] : [sizedPart(partOf(bullets(item.points), styles.point), theme, room)]),
        ],
        { pad, gap: scale.gap, fill: "background2" },
      ),
    )
    return rowOf(area, cards, gap, scale.root)
  }
}

const cards = cardsLike(1, "text", true)
const compare = cardsLike(2, "accent1", false)

function axisLabel(words: string, box: Area, rotation: number, scale: Scale): Block {
  const part = partOf(words, scale.styles.label, "text2", true)
  return {
    type: "shape",
    values: {
      box: { ...zeroBox, ...box, rotation },
      geometry: { kind: "rect" },
      text: { ...part.text, resize: "fixed", alignV: "center" },
    },
  }
}

const matrix: Build = (area, items, scale) => {
  const { gap, pad, theme, styles } = scale
  const strip = scale.axes === undefined ? 0 : Math.round(theme.textStyles[styles.label].size * axisShare)
  const grid = { x: strip, y: 0, w: area.w - strip, h: area.h - strip }
  const cellW = Math.floor((grid.w - gap) / 2)
  const cellH = Math.floor((grid.h - gap) / 2)
  const room = cellW - pad * 2
  const cells = [0, 1, 2, 3].map((at) => {
    const item = items[at] ?? {}
    const lead = at === 1
    const ink = lead ? "background" : "text"
    return cardOf(
      [
        ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading, ink), theme, room)]),
        ...(item.points === undefined ? [] : [sizedPart(partOf(bullets(item.points), styles.point, ink), theme, room)]),
      ],
      { pad, gap, fill: lead ? "accent1" : "background2", cell: { row: Math.floor(at / 2), col: at % 2 } },
    )
  })
  if (Math.max(...cells.map((cell) => cell.high)) > cellH) return undefined
  const quadrants = frameOf(
    {
      ...(scale.axes === undefined ? scale.root : {}),
      box: scale.axes === undefined ? boxIn(area, area.h) : { ...zeroBox, ...grid },
      layout: {
        mode: "grid",
        columns: [{ fr: 1 }, { fr: 1 }],
        rows: [{ fr: 1 }, { fr: 1 }],
        gap,
        padding: sidesOf(0),
      },
    },
    cells.map((cell) => cell.block),
  )
  if (scale.axes === undefined) return quadrants
  const lower = Math.round(gap / 3)
  return frameOf({ ...scale.root, box: boxIn(area, area.h) }, [
    quadrants,
    axisLabel(scale.axes[0], { x: strip, y: grid.h + lower, w: grid.w, h: strip - lower }, 0, scale),
    axisLabel(
      scale.axes[1],
      { x: strip / 2 - grid.h / 2, y: grid.h / 2 - strip / 2, w: grid.h, h: strip },
      wrapRotation(-90),
      scale,
    ),
  ])
}

const flowSpacing = (scale: Scale) => Math.max(scale.gap * 2, arrowRoom)

const flowWordsFit = (items: readonly AgentItem[], scale: Scale, room: Px) =>
  wordsFit(wordsOf(items, "title"), scale.theme, scale.styles.heading, room) &&
  wordsFit(wordsOf(items, "note"), scale.theme, scale.styles.caption, room)

const flowDown: Build = (area, items, scale) => {
  const { pad, theme, styles } = scale
  const cardW = Math.min(area.w, Math.max(pad * 8, Math.round(area.w * flowWidthShare)))
  const room = cardW - pad * 2
  if (!flowWordsFit(items, scale, room)) return undefined
  const steps = items.map((item, at) =>
    cardOf(
      [
        ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading, "text", true), theme, room)]),
        ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2", true), theme, room)]),
      ],
      { pad, gap: scale.gap, fill: "background2", key: `s${at}`, hug: true },
    ),
  )
  const spread = spreadDown(
    area,
    steps.map((step) => step.high),
    flowSpacing(scale),
  )
  if (spread === undefined) return undefined
  const lane = frameOf(
    {
      box: { ...zeroBox, x: Math.round((area.w - cardW) / 2), w: cardW, h: spread.high },
      layout: { mode: "column", gap: spread.gap, padding: sidesOf(0), align: "top-left" },
    },
    steps.map((each) => each.block),
  )
  const arrows = items.slice(1).map((_, at): Block => ({
    type: "shape",
    values: (ref) => ({
      box: { ...zeroBox, x: Math.round(area.w / 2), y: 0, w: 0, h: spread.gap },
      geometry: {
        kind: "line",
        start: { node: ref(`s${at}`), site: "b" },
        end: { node: ref(`s${at + 1}`), site: "t" },
        route: "straight",
        arrows: ["none", "arrow"],
      },
      strokes: [solid("text2")],
      stroke: strokeOf(connectorWeight),
    }),
  }))
  return frameOf({ ...scale.root, box: boxIn(area, spread.high) }, [lane, ...arrows])
}

function flowAcross(area: Area, items: readonly AgentItem[], scale: Scale, wrapped: boolean): Block | undefined {
  const { pad, theme, styles } = scale
  const spacing = flowSpacing(scale)
  const cardW = slotWidth(area, items.length, spacing)
  const room = cardW - pad * 2
  if (room <= 0) return undefined
  const oneLine =
    widestWhole(wordsOf(items, "title"), theme, styles.heading) <= room &&
    widestWhole(wordsOf(items, "note"), theme, styles.caption) <= room
  if (wrapped ? !flowWordsFit(items, scale, room) : !oneLine) return undefined
  const steps = items.map((item, at) =>
    cardOf(
      [
        ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading, "text", true), theme, room)]),
        ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2", true), theme, room)]),
      ],
      { pad, gap: scale.gap, fill: "background2", key: `s${at}` },
    ),
  )
  const tallest = Math.max(...steps.map((step) => step.high))
  if (tallest > area.h) return undefined
  const high = scale.filled ? area.h : tallest
  const lane = frameOf(
    {
      box: { ...zeroBox, w: area.w, h: high },
      layout: { mode: "row", gap: spacing, padding: sidesOf(0), align: "top-left" },
    },
    steps.map((each) => each.block),
  )
  const arrows = items.slice(1).map((_, at): Block => ({
    type: "shape",
    values: (ref) => ({
      box: { ...zeroBox, x: 0, y: 0, w: spacing, h: 0 },
      geometry: {
        kind: "line",
        start: { node: ref(`s${at}`), site: "r" },
        end: { node: ref(`s${at + 1}`), site: "l" },
        route: "straight",
        arrows: ["none", "arrow"],
      },
      strokes: [solid("text2")],
      stroke: strokeOf(connectorWeight),
    }),
  }))
  return frameOf({ ...scale.root, box: boxIn(area, high) }, [lane, ...arrows])
}

const flowAcrossOneLine: Build = (area, items, scale) => flowAcross(area, items, scale, false)
const flowAcrossWrapped: Build = (area, items, scale) => flowAcross(area, items, scale, true)

const stepped = (build: Build): Way => ({ build, stepping: true })
const fixed = (build: Build): Way => ({ build, stepping: false })

const builders: Readonly<Record<PatternName, readonly Way[]>> = {
  kpi: [stepped(kpi)],
  cards: [stepped(cards)],
  compare: [stepped(compare)],
  matrix: [stepped(matrix)],
  timeline: [fixed(timelineAcross), fixed(timeline), stepped(timelineAcross)],
  flow: [fixed(flowAcrossOneLine), fixed(flowDown), stepped(flowAcrossWrapped)],
}

const tooMuch: Readonly<Partial<Record<PatternName, string>>> = {
  timeline: "shorter labels or fewer steps",
  flow: "shorter labels or fewer steps",
}

export function addPattern(draft: Draft, parent: Node, change: Add): void {
  const kind = change.kind as PatternName
  const items =
    change.items ?? stop("shape", undefined, "items", "missing", "One item or more, in the shape this pattern takes.")
  const [fewest, most] = counts[kind]
  if (items.length > most) stop("limit", undefined, "items")
  if (items.length < fewest) stop("shape", undefined, "items", "form", `${String(fewest)} to ${String(most)} items.`)
  const area = patternArea(draft, parent, change.box)
  const theme = themeOf(draft)
  const width = slideSize(draft).w
  const root: Values = {
    name: change.name ?? names[kind],
    ...(change.hidden === undefined ? {} : { hidden: change.hidden }),
  }
  const place = ({ build: way, stepping }: Way): Block | undefined => {
    const make = (at: Area, styles: Styles) =>
      way(at, items, {
        gap: gapFor(width),
        pad: padFor(width),
        theme,
        styles,
        root,
        filled: change.box !== undefined,
        axes: change.axes,
      })
    const start = stylesAt(theme, 0)
    const first = make(area, start)
    const borrowed =
      change.box === undefined && !endsInside(draft, first) ? borrowing(draft, parent, area, make, start) : undefined
    return borrowed ?? first ?? (stepping ? largestFitting(theme, (styles) => make(area, styles)) : undefined)
  }
  const reason = tooMuch[kind]
  const block =
    builders[kind].reduce<Block | undefined>((got, way) => got ?? place(way), undefined) ??
    (reason === undefined ? stop("limit", undefined, "items") : stop("limit", undefined, "items", "needs", reason))
  emit(draft, parent.id, block)
}

function weighted(part: Part, bold: boolean, font: string): Part {
  const { chars, spans } = part.text
  const open = spans.length === 0 ? [{ end: chars.length }] : spans
  const text: Text = {
    ...part.text,
    spans: open.map((span) => ({ ...span, bold: span.bold ?? bold, font: span.font ?? font })),
  }
  const values = part.block.values as Values
  return { ...part, text, block: { ...part.block, values: { ...values, text } } }
}

export function addGrid(draft: Draft, parent: Node, change: Add): void {
  const rows =
    change.rows ??
    stop(
      "shape",
      undefined,
      "rows",
      "missing",
      "One row or more, each with one cell or more. An empty string leaves a cell empty.",
    )
  if (rows.length === 0 || rows.some((row) => row.length === 0))
    stop("shape", undefined, "rows", "form", "One row or more, each with one cell or more.")
  if (change.layout !== undefined) stop("shape", undefined, "layout", "needs", "rows to place the grid")
  const area = patternArea(draft, parent, change.box)
  const theme = themeOf(draft)
  const gap = gapFor(slideSize(draft).w)
  const columns = Math.max(...rows.map((row) => row.length))
  const room = Math.floor((area.w - gap * (columns - 1)) / columns)
  const ladder = ladderOf(theme)
  const steps = ladder.slice(ladder.indexOf("heading"), ladder.indexOf("caption") + 1)
  const attempt = (style: TextStyleName) => {
    const labelled = (at: number, col: number) => at === 0 || col === 0
    const whole = rows.every((row, at) =>
      row.every((cell, col) => wordsFit([cell], theme, style, room, labelled(at, col))),
    )
    if (!whole) return undefined
    const cells = rows.map((row, at) =>
      row.map((cell, col) =>
        cell === ""
          ? undefined
          : weighted(partOf(cell, style, at === 0 ? "text2" : "text"), labelled(at, col), theme.fonts.body),
      ),
    )
    const heights = cells.map((row) =>
      Math.max(0, ...row.map((part) => (part === undefined ? 0 : heightIn(part, theme, room)))),
    )
    const total = heights.reduce((sum, high) => sum + high, 0) + gap * (rows.length - 1)
    if (total > area.h) return undefined
    return frameOf(
      {
        ...surfaceOf(change),
        name: change.name ?? "Grid",
        box: { ...boxIn(area, change.box !== undefined ? area.h : total), ...turnOf(change) },
        layout: {
          mode: "grid",
          columns: Array.from({ length: columns }, () => ({ fr: 1 })),
          rows: rows.map(() => "hug" as const),
          gap,
          padding: sidesOf(0),
        },
      },
      cells.flatMap((row, r) =>
        row.flatMap((part, c): Block[] => {
          if (part === undefined) return []
          const body = r > 0
          const values = part.block.values as Values
          const text = body ? { ...(values.text as Text), alignV: "center" as const } : values.text
          return [
            {
              ...part.block,
              values: {
                ...values,
                ...(body ? { sizing: { w: "fill", h: "fill" }, text } : {}),
                cell: { row: r, col: c },
              },
            },
          ]
        }),
      ),
    )
  }
  const block =
    steps.reduce<Block | undefined>((got, style) => got ?? attempt(style), undefined) ??
    stop("limit", undefined, "items", "needs", "shorter labels, fewer columns or fewer rows")
  emit(draft, parent.id, block)
}
