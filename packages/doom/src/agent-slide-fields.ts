import { field } from "./agent-fields.js"
import { type NodeId, readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { Reject, accepting, formed, forms, list, literal, object, union } from "./read-kit.js"

export const idSchema = { $ref: "#/$defs/id" }
export const readId = formed(readNodeId, forms.node)
export const readAfter = accepting(forms.after, (raw) => (raw === null ? null : readId(raw)))

export type SlideAdd = { readonly after?: NodeId | null; readonly group?: NodeId | "new" }
export type SlideMove = {
  readonly slide?: NodeId
  readonly slides?: readonly NodeId[]
  readonly group?: NodeId | "new"
  readonly after?: NodeId | null
  readonly before?: NodeId
}
export const slideForm = {
  moveWhat: "A slide id, or a slide group id.",
  followSlide: "A slide id, or null to put it first.",
  followGroup: "Use before or after with a slide group id. Use after null to put it first.",
  beforeGroup: "Use before only to move a whole slide group. For slides, use after.",
  notBoth: "slide or slides, not both.",
  newSlides: "Slide ids, or add with group new to start a group with a new slide.",
  addFirst: "A slide id. Name the group and after null to put it first.",
} as const
const readGroup = union<NodeId | "new">("A slide group id, or new.", [readId, literal(["new"])])

function readSlideAdd(raw: unknown): SlideAdd {
  const value = object({}, { after: readAfter, group: readGroup })(raw)
  if (value.group === undefined && value.after === null) throw new Reject("shape", "after", "form", slideForm.addFirst)
  return value
}

function readSlideMove(raw: unknown): SlideMove {
  const value = object(
    {},
    { slide: readId, slides: list(readId, limits.delete, 1), group: readGroup, after: readAfter, before: readId },
  )(raw)
  const named = value.slide !== undefined || value.slides !== undefined
  if (value.slide !== undefined && value.slides !== undefined)
    throw new Reject("shape", undefined, "form", slideForm.notBoth)
  if (!named && value.group === undefined) throw new Reject("shape", undefined, "form", slideForm.moveWhat)
  if (!named && value.group === "new") throw new Reject("shape", "group", "form", slideForm.newSlides)
  if (value.before !== undefined) {
    if (named) throw new Reject("shape", "before", "form", slideForm.beforeGroup)
    if (value.after !== undefined) throw new Reject("shape", "before", "form", slideForm.followGroup)
  } else if (value.after === undefined)
    throw new Reject("shape", "after", "missing", named ? slideForm.followSlide : slideForm.followGroup)
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
          description:
            "Slide to follow. With group new, group to follow. Omit for last, or name a group and use null for first.",
        },
        group: { oneOf: [idSchema, { const: "new" }], description: "A group id, or new." },
      },
      description: "Add a slide.",
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
      description:
        'Move slide or slides, with after a slide id or null for first, and optional destination group. With group "new", after names a group or null. Move a whole group by sending only group and either before or after a group id (after null puts it first).',
    },
    readSlideMove,
  ),
  delete: field({ ...idSchema, description: "A slide to delete." }, readId),
} as const
