import { readElementId, readSlideId, type ElementId, type SlideId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"
import { slideSchema } from "./set-wire.js"

export const slideOps = ["add_slide", "duplicate_slide", "delete_slide", "move_slide"] as const
export type SlideOp = (typeof slideOps)[number]

export type WireSlideChange =
  | { readonly op: "add_slide"; readonly after: SlideId; readonly layout: SlideId }
  | { readonly op: "duplicate_slide" | "delete_slide"; readonly slide: SlideId }
  | { readonly op: "move_slide"; readonly slide: SlideId; readonly after: SlideId | null }

export type WireDelete = { readonly op: "delete"; readonly node: ElementId }

type Read<Change> =
  | { readonly ok: true; readonly change: Change }
  | { readonly ok: false; readonly refusal: "field"; readonly field: string }

const fieldsOf = {
  add_slide: ["after", "layout"],
  duplicate_slide: ["slide"],
  delete_slide: ["slide"],
  move_slide: ["slide", "after"],
} as const satisfies Record<SlideOp, readonly string[]>

function refused(field: string): { readonly ok: false; readonly refusal: "field"; readonly field: string } {
  return { ok: false, refusal: "field", field }
}

function bodyOf(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Readonly<Record<string, unknown>>)
    : undefined
}

export function readSlideChange(raw: unknown): Read<WireSlideChange> {
  const body = bodyOf(raw)
  const op = slideOps.find((each) => each === body?.op)
  if (body === undefined || op === undefined) return refused("op")
  const fields: readonly string[] = fieldsOf[op]
  const extra = Object.keys(body).find((key) => key !== "op" && !fields.includes(key))
  if (extra !== undefined) return refused(extra)
  const missing = fields.find((key) => !Object.hasOwn(body, key))
  if (missing !== undefined) return refused(missing)
  if (op === "add_slide") {
    const after = readSlideId(body.after)
    const layout = readSlideId(body.layout)
    if (after === undefined) return refused("after")
    if (layout === undefined) return refused("layout")
    return { ok: true, change: { op, after, layout } }
  }
  const slide = readSlideId(body.slide)
  if (slide === undefined) return refused("slide")
  if (op !== "move_slide") return { ok: true, change: { op, slide } }
  const after = body.after === null ? null : readSlideId(body.after)
  if (after === undefined) return refused("after")
  return { ok: true, change: { op, slide, after } }
}

export function readDeleteChange(raw: unknown): Read<WireDelete> {
  const body = bodyOf(raw)
  if (body === undefined || body.op !== "delete") return refused("op")
  const extra = Object.keys(body).find((key) => key !== "op" && key !== "node")
  if (extra !== undefined) return refused(extra)
  const node = readElementId(body.node)
  if (node === undefined) return refused("node")
  return { ok: true, change: { op: "delete", node } }
}

export function slideChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op"],
    description:
      "add_slide takes after and layout; duplicate_slide and delete_slide take slide; move_slide takes slide and after. New slide ids come back in slides. The last slide cannot be deleted.",
    properties: {
      op: { type: "string", enum: slideOps },
      slide: slideSchema,
      after: {
        anyOf: [slideSchema, { type: "null" }],
        description: "Place it after this slide id; with move_slide, null for the beginning.",
      },
      layout: { ...slideSchema, description: "Use the layout of this slide id." },
    },
  }
}

export function deleteChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "node"],
    description:
      "Delete one element. A group, an element inside a group, and an element with an animation cannot be deleted.",
    properties: {
      op: { type: "string", const: "delete" },
      node: {
        type: "string",
        pattern: "^(?:[0-9]{1,10}|n[0-9a-z]{12})\\.(?:[0-9]{1,10}|n[0-9a-z]{12})$",
        description: "Element id such as 258.7.",
      },
    },
  }
}
