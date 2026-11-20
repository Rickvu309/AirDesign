import { limits, readElementId, type ElementId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"

export const groupOps = ["group", "ungroup", "frame", "join", "leave", "duplicate"] as const

export type WireGroup = { readonly op: (typeof groupOps)[number]; readonly elements: readonly ElementId[] }

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
  const extra = Object.keys(body).find((key) => key !== "op" && key !== "elements")
  if (extra !== undefined) return refused(extra)
  if (!Array.isArray(body.elements) || body.elements.length > limits.batch) return refused("elements")
  const elements: ElementId[] = []
  for (const item of body.elements) {
    const node = readElementId(item)
    if (node === undefined || elements.includes(node)) return refused("elements")
    elements.push(node)
  }
  if (elements.length < (op === "group" || op === "join" ? 2 : 1)) return refused("elements")
  return { ok: true, change: { op, elements } }
}

export function groupChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "elements"],
    description:
      "group: two or more layers of one slide; frame: the same, as an auto layout frame; ungroup: back into parts; join: elements[0] is a group or frame, the rest join it; leave: children back to the slide; duplicate: copies each layer just above it. New ids come back in elements.",
    properties: {
      op: { type: "string", enum: groupOps },
      elements: {
        type: "array",
        minItems: 1,
        maxItems: limits.batch,
        items: { type: "string" },
        description: "Layer ids such as 258.7.",
      },
    },
  }
}
