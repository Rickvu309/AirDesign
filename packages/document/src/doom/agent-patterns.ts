import type { AgentChange, AgentItem, PatternName } from "./agent-change.js"
import { type Draft, type Values, stop } from "./agent-draft.js"
import { iconName, sidesOf, solid, surfaceOf } from "./agent-look.js"
import { type Area, areaFor, gapFor, padFor, slideSize, themeOf } from "./agent-place.js"
import type { Px } from "./paint.js"
import {
  type Block,
  type Sized,
  type Styles,
  bullets,
  cardOf,
  emit,
  fitting,
  frameOf,
  heightIn,
  ladderOf,
  partOf,
  sizedPart,
} from "./pattern-parts.js"
import type { Node } from "./doom.js"
import type { Text } from "./text.js"
import { zeroBox } from "./doom-walk.js"
import type { TextStyleName } from "./text.js"
import { widestLine } from "./text-estimate.js"
import type { Theme } from "./theme.js"

type Add = Extract<AgentChange, { op: "add" }>
type Scale = {
  readonly gap: Px
  readonly pad: Px
  readonly theme: Theme
  readonly styles: Styles
  readonly root: Values
  readonly filled: boolean
  readonly axes?: readonly [string, string] | undefined
}
type Build = (area: Area, items: readonly AgentItem[], scale: Scale) => Block | undefined

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
const kpiShare = 0.45
const cardsShare = 0.5
const gridShare = 0.7
const iconShare = 1.7
const dotShare = 0.7
const axisShare = 2.6
const arrowRoom = 48
const connectorWeight = 3
const slideWeight = 3

const slotWidth = (area: Area, count: number, gap: Px) => Math.floor((area.w - gap * (count - 1)) / count)
const boxIn = (area: Area, h: Px) => ({ ...zeroBox, x: area.x, y: area.y, w: area.w, h })
const strokeOf = (weight: Px) => ({ weight, align: "center" as const, dash: "solid" as const })

const stretched = (area: Area, hug: Px, filled: boolean, share: number): Px =>
  filled ? area.h : Math.min(area.h, Math.max(hug, Math.round(area.h * share)))

function rowOf(
  area: Area,
  cards: readonly Sized[],
  gap: Px,
  filled: boolean,
  root: Values,
  share: number,
): Block | undefined {
  const tallest = Math.max(...cards.map((card) => card.high))
  if (tallest > area.h) return undefined
  return frameOf(
    {
      ...root,
      box: boxIn(area, stretched(area, tallest, filled, share)),
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
  const from = ladder.indexOf(start)
  const to = Math.max(from, ladder.indexOf("heading"))
  return (
    ladder.slice(from, to + 1).find((style) => widestLine(values, theme, style) <= room) ??
    (ladder[to] as TextStyleName)
  )
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
      { pad, gap, fill: "background2", align: "center-left" },
    ),
  )
  return rowOf(area, cards, gap, scale.filled, scale.root, kpiShare)
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
    return rowOf(area, cards, gap, scale.filled, scale.root, items.length === 1 ? 0 : cardsShare)
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
    axisLabel(scale.axes[1], { x: strip / 2 - grid.h / 2, y: grid.h / 2 - strip / 2, w: grid.h, h: strip }, -90, scale),
  ])
}

const timeline: Build = (area, items, scale) => {
  const { gap, pad, theme, styles } = scale
  const width = slotWidth(area, items.length, gap)
  const dot = Math.round(pad * dotShare)
  const columns = items.map((item, at): Sized => {
    const marker: Sized = {
      high: dot,
      block: {
        type: "shape",
        key: `m${at}`,
        values: { box: { ...zeroBox, w: dot, h: dot }, geometry: { kind: "ellipse" }, fills: [solid("accent1")] },
      },
    }
    const members = [
      marker,
      ...(item.value === undefined ? [] : [sizedPart(partOf(item.value, styles.label, "accent1"), theme, width)]),
      ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading), theme, width)]),
      ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2"), theme, width)]),
    ]
    const inner = Math.round(gap / 2)
    return {
      high: members.reduce((sum, member) => sum + member.high, 0) + inner * (members.length - 1),
      block: frameOf(
        {
          sizing: { w: "fill", h: "fill" },
          layout: { mode: "column", gap: inner, padding: sidesOf(0), align: "top-left" },
        },
        members.map((member) => member.block),
      ),
    }
  })
  const high = Math.max(...columns.map((column) => column.high))
  if (high > area.h) return undefined
  const last = items.length - 1
  const line: Block = {
    type: "shape",
    values: (ref) => ({
      box: { ...zeroBox, x: Math.round(dot / 2), y: Math.round(dot / 2), w: last * (width + gap), h: 0 },
      geometry: {
        kind: "line",
        start: { node: ref("m0"), site: "c" },
        end: { node: ref(`m${last}`), site: "c" },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: [solid("accent1")],
      stroke: strokeOf(slideWeight),
    }),
  }
  const lane = frameOf(
    {
      box: { ...zeroBox, w: area.w, h: high },
      layout: { mode: "row", gap, padding: sidesOf(0), align: "top-left" },
    },
    columns.map((column) => column.block),
  )
  return frameOf({ ...scale.root, box: boxIn(area, high) }, [line, lane])
}

const flow: Build = (area, items, scale) => {
  const { pad, theme, styles } = scale
  const step = Math.max(scale.gap * 2, arrowRoom)
  const width = slotWidth(area, items.length, step)
  const room = width - pad * 2
  const steps = items.map((item, at) =>
    cardOf(
      [
        ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading, "text", true), theme, room)]),
        ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2", true), theme, room)]),
      ],
      { pad, gap: scale.gap, fill: "background2", key: `s${at}` },
    ),
  )
  const high = Math.max(...steps.map((each) => each.high))
  if (high > area.h) return undefined
  const lane = frameOf(
    {
      box: { ...zeroBox, w: area.w, h: high },
      layout: { mode: "row", gap: step, padding: sidesOf(0), align: "top-left" },
    },
    steps.map((each) => each.block),
  )
  const arrows = items.slice(1).map((_, at): Block => ({
    type: "shape",
    values: (ref) => ({
      box: { ...zeroBox, x: (at + 1) * width + at * step, y: Math.round(high / 2), w: step, h: 0 },
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

const builders: Readonly<Record<PatternName, Build>> = { kpi, cards, compare, matrix, timeline, flow }

export function addPattern(draft: Draft, parent: Node, change: Add): void {
  const kind = change.kind as PatternName
  const items = change.items ?? stop("shape", undefined, "items")
  const [fewest, most] = counts[kind]
  if (items.length > most) stop("limit", undefined, "items")
  if (items.length < fewest) stop("shape", undefined, "items")
  const area = areaFor(draft, parent, change.box)
  const theme = themeOf(draft)
  const width = slideSize(draft).w
  const root: Values = {
    name: change.name ?? names[kind],
    ...(change.hidden === undefined ? {} : { hidden: change.hidden }),
  }
  const block = fitting(theme, (styles) =>
    builders[kind](area, items, {
      gap: gapFor(width),
      pad: padFor(width),
      theme,
      styles,
      root,
      filled: change.box !== undefined,
      axes: change.axes,
    }),
  )
  emit(draft, parent.id, block)
}

export function addGrid(draft: Draft, parent: Node, change: Add): void {
  const rows = change.rows ?? stop("shape", undefined, "rows")
  if (rows.length === 0 || rows.some((row) => row.length === 0)) stop("shape", undefined, "rows")
  if (change.layout !== undefined) stop("shape", undefined, "layout")
  const area = areaFor(draft, parent, change.box)
  const theme = themeOf(draft)
  const gap = gapFor(slideSize(draft).w)
  const columns = Math.max(...rows.map((row) => row.length))
  const room = Math.floor((area.w - gap * (columns - 1)) / columns)
  const block = fitting(theme, (styles) => {
    const cells = rows.map((row, at) =>
      row.map((cell) =>
        cell === ""
          ? undefined
          : at === 0
            ? partOf(`**${cell}**`, styles.point, "text2")
            : partOf(cell, styles.point, "text"),
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
        box: boxIn(area, stretched(area, total, change.box !== undefined, gridShare)),
        layout: {
          mode: "grid",
          columns: Array.from({ length: columns }, () => ({ fr: 1 })),
          rows: rows.map((_, at) => (at === 0 ? ("hug" as const) : { fr: 1 })),
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
  })
  emit(draft, parent.id, block)
}
