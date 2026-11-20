import { readSlideId, type Box, type SlideId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"
import { placedBoxSchema, readPlacedBox, slideSchema } from "./set-wire.js"
import { storableText } from "./storable-text.js"

export const diagramLabels = { min: 2, max: 8, length: 100 } as const

export type WireDiagram = {
  readonly op: "diagram"
  readonly slide: SlideId
  readonly labels: readonly string[]
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

export function readDiagramChange(raw: unknown): Read {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return refused("op")
  const body = raw as Readonly<Record<string, unknown>>
  if (body.op !== "diagram") return refused("op")
  const extra = Object.keys(body).find((key) => !["op", "slide", "labels", "box"].includes(key))
  if (extra !== undefined) return refused(extra)
  const slide = readSlideId(body.slide)
  if (slide === undefined) return refused("slide")
  const { labels } = body
  if (!Array.isArray(labels) || labels.length < diagramLabels.min || labels.length > diagramLabels.max)
    return refused("labels")
  if (!labels.every(labelled)) return refused("labels")
  if (body.box === undefined) return { ok: true, change: { op: "diagram", slide, labels } }
  const box = readPlacedBox(body.box)
  return box === null ? refused("box") : { ok: true, change: { op: "diagram", slide, labels, box } }
}

export function diagramChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "slide", "labels"],
    description:
      "A grouped row of rounded shapes, one per label, joined left to right by arrow connectors. Omit box to use the largest free area. Ids come back in elements.",
    properties: {
      op: { type: "string", const: "diagram" },
      slide: slideSchema,
      labels: {
        type: "array",
        minItems: diagramLabels.min,
        maxItems: diagramLabels.max,
        items: { type: "string", minLength: 1, maxLength: diagramLabels.length },
        description: "Each shape's words, in order.",
      },
      box: placedBoxSchema(),
    },
  }
}
