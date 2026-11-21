import { readSlideId, type Box, type SlideId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"
import { placedBoxSchema, readPlacedBox, slideSchema } from "./set-wire.js"
import { storableText } from "./storable-text.js"

export const diagramLabels = { min: 2, max: 8, length: 100 } as const

export const patternNames = ["flow", "kpi", "cards", "compare", "matrix", "timeline"] as const

export type PatternName = (typeof patternNames)[number]

export const patternItems = { min: 2, max: 6, title: 60, value: 16, note: 90, points: 5, point: 100 } as const

export type PatternItem = {
  readonly title?: string
  readonly value?: string
  readonly note?: string
  readonly points?: readonly string[]
  readonly icon?: string
}

export type WireDiagram = {
  readonly op: "diagram"
  readonly slide: SlideId
  readonly labels?: readonly string[]
  readonly pattern?: PatternName
  readonly items?: readonly PatternItem[]
  readonly box?: Box
}

type Read =
  | { readonly ok: true; readonly change: WireDiagram }
  | { readonly ok: false; readonly refusal: "field"; readonly field: string }

function refused(field: string): Read {
  return { ok: false, refusal: "field", field }
}

function labelled(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim() !== "" && raw.length <= diagramLabels.length && storableText(raw)
}

function worded(raw: unknown, length: number): raw is string {
  return typeof raw === "string" && raw.trim() !== "" && raw.length <= length && storableText(raw)
}

function readItem(raw: unknown): PatternItem | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const body = raw as Readonly<Record<string, unknown>>
  if (Object.keys(body).some((key) => !["title", "value", "note", "points", "icon"].includes(key))) return null
  const words = (key: "title" | "value" | "note" | "icon", length: number) =>
    body[key] === undefined || worded(body[key], length)
  if (!words("title", patternItems.title) || !words("value", patternItems.value)) return null
  if (!words("note", patternItems.note) || !words("icon", 64)) return null
  const { points } = body
  if (points !== undefined && (!Array.isArray(points) || points.length > patternItems.points)) return null
  if (Array.isArray(points) && !points.every((point) => worded(point, patternItems.point))) return null
  return body as PatternItem
}

export function readDiagramChange(raw: unknown): Read {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return refused("op")
  const body = raw as Readonly<Record<string, unknown>>
  if (body.op !== "diagram") return refused("op")
  const extra = Object.keys(body).find((key) => !["op", "slide", "labels", "pattern", "items", "box"].includes(key))
  if (extra !== undefined) return refused(extra)
  const slide = readSlideId(body.slide)
  if (slide === undefined) return refused("slide")
  const pattern = body.pattern === undefined ? "flow" : patternNames.find((name) => name === body.pattern)
  if (pattern === undefined) return refused("pattern")
  const box = body.box === undefined ? undefined : readPlacedBox(body.box)
  if (box === null) return refused("box")
  const placed = box === undefined ? {} : { box }
  if (pattern === "flow") {
    const { labels } = body
    if (!Array.isArray(labels) || labels.length < diagramLabels.min || labels.length > diagramLabels.max)
      return refused("labels")
    if (!labels.every(labelled)) return refused("labels")
    return { ok: true, change: { op: "diagram", slide, labels, ...placed } }
  }
  const { items } = body
  if (!Array.isArray(items) || items.length < patternItems.min || items.length > patternItems.max)
    return refused("items")
  const read = items.map(readItem)
  if (read.some((item) => item === null)) return refused("items")
  const { labels } = body
  if (
    labels !== undefined &&
    (pattern !== "matrix" || !Array.isArray(labels) || labels.length !== 2 || !labels.every(labelled))
  )
    return refused("labels")
  const axes = labels === undefined ? {} : { labels: labels as string[] }
  return { ok: true, change: { op: "diagram", slide, pattern, items: read as PatternItem[], ...axes, ...placed } }
}

export function diagramChangeSchema(): JsonSchema {
  const words = (maxLength: number, description: string) => ({ type: "string", minLength: 1, maxLength, description })
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "slide"],
    description:
      "A laid-out slide part, built from auto layout frames the server sizes and spaces with the deck's colors and type. Omit box to use the largest free area. Ids come back in elements.",
    properties: {
      op: { type: "string", const: "diagram" },
      slide: slideSchema,
      pattern: {
        type: "string",
        enum: [...patternNames],
        description:
          "flow (default): labels joined by arrows. kpi, cards, compare (2-3), matrix (4: top left first), timeline take items.",
      },
      labels: {
        type: "array",
        minItems: diagramLabels.min,
        maxItems: diagramLabels.max,
        items: { type: "string", minLength: 1, maxLength: diagramLabels.length },
        description: "flow: each shape's words, in order. matrix: the x then y axis title.",
      },
      items: {
        type: "array",
        minItems: patternItems.min,
        maxItems: patternItems.max,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: words(patternItems.title, "Heading; a KPI's label; a milestone."),
            value: words(patternItems.value, "A KPI's number; a milestone's date."),
            note: words(patternItems.note, "One line under it, such as a KPI's change."),
            points: { type: "array", maxItems: patternItems.points, items: words(patternItems.point, "A bullet.") },
            icon: words(64, "cards: an icon name."),
          },
        },
      },
      box: placedBoxSchema(),
    },
  }
}
