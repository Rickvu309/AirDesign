import { limits, readElementId, readSlideId, type ElementId, type SlideId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"

export const groupOps = ["group", "ungroup", "frame", "join", "leave", "duplicate"] as const

export type PasteSpot = { readonly slide?: SlideId; readonly x?: number; readonly y?: number }

export type WireGroup = { readonly op: (typeof groupOps)[number]; readonly elements: readonly ElementId[] } & PasteSpot

const spotKeys = ["slide", "x", "y"]

function readSpot(body: Readonly<Record<string, unknown>>): PasteSpot | string {
  const slide = body.slide === undefined ? undefined : readSlideId(body.slide)
  if (body.slide !== undefined && slide === undefined) return "slide"
  const sides = [body.x, body.y]
  if (sides.some((side) => side !== undefined) && !sides.every((side) => Number.isInteger(side))) return "x"
  const at = Number.isInteger(body.x) ? { x: body.x as number, y: body.y as number } : {}
  return { ...(slide === undefined ? {} : { slide }), ...at }
}

type Read =
  | { readonly ok: true; readonly change: WireGroup }
  | { readonly ok: false; readonly refusal: "field"; readonly field: string }

function refused(field: string): Read {
  return { ok: false, refusal: "field", field }
}

export function readGroupChange(raw: unknown): Read {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return refused("op")
  const body = raw as Readonly<Record<string, unknown>>
  const op = groupOps.find((each) => each === body.op)
  if (op === undefined) return refused("op")
  const allowed = op === "duplicate" ? ["op", "elements", ...spotKeys] : ["op", "elements"]
  const extra = Object.keys(body).find((key) => !allowed.includes(key))
  if (extra !== undefined) return refused(extra)
  const spot = readSpot(body)
  if (typeof spot === "string") return refused(spot)
  if (!Array.isArray(body.elements) || body.elements.length > limits.batch) return refused("elements")
  const elements: ElementId[] = []
  for (const item of body.elements) {
    const node = readElementId(item)
    if (node === undefined || elements.includes(node)) return refused("elements")
    elements.push(node)
  }
  if (elements.length < (op === "group" || op === "join" ? 2 : 1)) return refused("elements")
  return { ok: true, change: { op, elements, ...spot } }
}

export function groupChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "elements"],
    description:
      "group: two or more layers of one slide; frame: the same, as an auto layout frame; ungroup: back into parts; join: the rest join elements[0], a group or frame; leave: children back to the slide; duplicate: copies above each layer, or onto slide with their top left at x, y. New ids come back in elements.",
    properties: {
      op: { type: "string", enum: groupOps },
      elements: {
        type: "array",
        minItems: 1,
        maxItems: limits.batch,
        items: { type: "string" },
        description: "Layer ids such as 258.7.",
      },
      slide: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
    },
  }
}
