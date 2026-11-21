import { limits, readElementId, readSlideId, type ElementId, type GridSide, type SlideId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"
import { canonicalOpFields } from "./field-alias.js"
import { slideSchema } from "./set-wire.js"

export const slideOps = [
  "add_slide",
  "duplicate_slide",
  "delete_slide",
  "move_slide",
  "move_slides",
  "duplicate_slides",
  "delete_slides",
] as const
export type SlideOp = (typeof slideOps)[number]

export type WireSlideChange =
  | {
      readonly op: "move_slides"
      readonly slides: readonly [SlideId, ...SlideId[]]
      readonly after: SlideId | null
      readonly group: GridSide | "keep"
    }
  | { readonly op: "duplicate_slides" | "delete_slides"; readonly slides: readonly [SlideId, ...SlideId[]] }
  | { readonly op: "add_slide"; readonly after?: SlideId; readonly layout?: SlideId; readonly group?: GridSide }
  | { readonly op: "duplicate_slide" | "delete_slide"; readonly slide: SlideId }
  | { readonly op: "move_slide"; readonly slide: SlideId; readonly after: SlideId | null }

export type WireDelete = { readonly op: "delete"; readonly node: ElementId }

type Read<Change> =
  | { readonly ok: true; readonly change: Change }
  | { readonly ok: false; readonly refusal: "field"; readonly field: string }

const fieldsOf = {
  add_slide: [],
  duplicate_slide: ["slide"],
  delete_slide: ["slide"],
  move_slide: ["slide", "after"],
  move_slides: ["slides", "after", "group"],
  duplicate_slides: ["slides"],
  delete_slides: ["slides"],
} as const satisfies Record<SlideOp, readonly string[]>

const addSlideKeys: readonly string[] = ["after", "layout", "group"]

function refused(field: string): { readonly ok: false; readonly refusal: "field"; readonly field: string } {
  return { ok: false, refusal: "field", field }
}

function bodyOf(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Readonly<Record<string, unknown>>)
    : undefined
}

export function readSlideChange(raw: unknown): Read<WireSlideChange> {
  const sent = bodyOf(raw)
  const op = slideOps.find((each) => each === sent?.op)
  if (sent === undefined || op === undefined) return refused("op")
  const named = canonicalOpFields(op, sent)
  if (!named.ok) return refused(named.field)
  const body = named.fields
  const fields: readonly string[] = fieldsOf[op]
  const extra = Object.keys(body).find(
    (key) => key !== "op" && !fields.includes(key) && !(op === "add_slide" && addSlideKeys.includes(key)),
  )
  if (extra !== undefined) return refused(extra)
  const missing = fields.find((key) => !Object.hasOwn(body, key))
  if (missing !== undefined) return refused(missing)
  if (op === "add_slide") {
    const after = body.after === undefined ? undefined : readSlideId(body.after)
    const layout = body.layout === undefined ? undefined : readSlideId(body.layout)
    if (body.after !== undefined && after === undefined) return refused("after")
    if (body.layout !== undefined && layout === undefined) return refused("layout")
    if (body.group !== undefined && body.group !== "same" && body.group !== "new") return refused("group")
    return {
      ok: true,
      change: {
        op,
        ...(after === undefined ? {} : { after }),
        ...(layout === undefined ? {} : { layout }),
        ...(body.group === undefined ? {} : { group: body.group }),
      },
    }
  }
  if (op === "move_slides" || op === "duplicate_slides" || op === "delete_slides") {
    if (!Array.isArray(body.slides) || body.slides.length > limits.slides) return refused("slides")
    const ids = body.slides.map((id: unknown) => readSlideId(id))
    const first = ids[0],
      rest = ids.slice(1).filter((id): id is NonNullable<typeof id> => id !== undefined)
    if (first === undefined || rest.length !== ids.length - 1 || new Set(ids).size !== ids.length)
      return refused("slides")
    if (op !== "move_slides") return { ok: true, change: { op, slides: [first, ...rest] } }
    const after = body.after === null ? null : readSlideId(body.after)
    if (after === undefined) return refused("after")
    if (body.group !== "same" && body.group !== "new" && body.group !== "keep") return refused("group")
    return { ok: true, change: { op, slides: [first, ...rest], after, group: body.group } }
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
      "add_slide: after, layout, group. duplicate_slide, delete_slide: slide. move_slide: slide, after. move_slides: slides in presentation order, after, group. duplicate_slides, delete_slides: slides; copies follow the last source. New ids come back in slides. The last slide cannot be deleted.",
    properties: {
      op: { type: "string", enum: slideOps },
      slide: slideSchema,
      slides: { type: "array", items: slideSchema, minItems: 1, maxItems: limits.slides, uniqueItems: true },
      after: {
        anyOf: [slideSchema, { type: "null" }],
        description: "After this slide id (add_slide: the last by default); move_slide: null for the beginning.",
      },
      layout: { ...slideSchema, description: "This slide's layout, by default after's." },
      group: {
        type: "string",
        enum: ["same", "new", "keep"],
        description:
          "Slide group. add_slide: same (default) or new. move_slides: same joins one, new starts one, keep moves a whole one; new/keep follow the anchor's slide group; null moves to the front.",
      },
    },
  }
}

export function deleteChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "node"],
    description: "Delete one layer; a group takes its layers. A layer in a plain group or an animated layer cannot be.",
    properties: {
      op: { type: "string", const: "delete" },
      node: {
        type: "string",
        pattern: "^(?:[0-9]{1,10}|n[0-9a-z]{12})\\.(?:[0-9]{1,10}|n[0-9a-z]{12})$",
        description: "Layer id such as 258.7.",
      },
    },
  }
}
