import { field } from "./agent-fields.js"
import { type NodeId, readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { Reject, accepting, formed, list, literal, object, union } from "./read-kit.js"

export const idSchema = { $ref: "#/$defs/id" }
export const readId = formed(readNodeId, { code: "node-id" })
export const readAfter = accepting({ code: "node-id-or-null" }, (raw) => (raw === null ? null : readId(raw)))

export type SlideAdd = { readonly after?: NodeId | null; readonly group?: NodeId | "new" }
export type SlideMove = {
  readonly slide?: NodeId
  readonly slides?: readonly NodeId[]
  readonly group?: NodeId | "new"
  readonly after?: NodeId | null
  readonly before?: NodeId
}
const readGroup = union<NodeId | "new">({ code: "slide-group-or-new" }, [readId, literal(["new"])])

function readSlideAdd(raw: unknown): SlideAdd {
  const value = object({}, { after: readAfter, group: readGroup })(raw)
  if (value.group === undefined && value.after === null)
    throw new Reject("shape", "after", "form", { code: "first-in-group" })
  return value
}

function readSlideMove(raw: unknown): SlideMove {
  const value = object(
    {},
    { slide: readId, slides: list(readId, limits.delete, 1), group: readGroup, after: readAfter, before: readId },
  )(raw)
  const named = value.slide !== undefined || value.slides !== undefined
  if (value.slide !== undefined && value.slides !== undefined)
    throw new Reject("shape", undefined, "form", { code: "slide-or-slides" })
  if (!named && value.group === undefined) throw new Reject("shape", undefined, "form", { code: "slide-or-group" })
  if (!named && value.group === "new") throw new Reject("shape", "group", "form", { code: "new-slide-group" })
  if (value.before !== undefined) {
    if (named) throw new Reject("shape", "before", "form", { code: "before-group-only" })
    if (value.after !== undefined) throw new Reject("shape", "before", "form", { code: "before-or-after-group" })
  } else if (value.after === undefined)
    throw new Reject("shape", "after", "missing", named ? { code: "after-slide" } : { code: "before-or-after-group" })
  return value
}
export const slideFields = {
  add: field(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        after: {
          oneOf: [idSchema, { type: "null" }],
        },
        group: { oneOf: [idSchema, { const: "new" }] },
      },
    },
    readSlideAdd,
  ),
  move: field(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        slide: idSchema,
        slides: { type: "array", items: idSchema, minItems: 1, maxItems: limits.delete },
        group: { oneOf: [idSchema, { const: "new" }] },
        after: { oneOf: [idSchema, { type: "null" }] },
        before: idSchema,
      },
    },
    readSlideMove,
  ),
  delete: field({ ...idSchema }, readId),
} as const
