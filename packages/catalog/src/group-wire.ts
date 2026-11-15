import { limits, readElementId, type ElementId } from "@airdesign/document"
import type { JsonSchema } from "./agent-form.js"

export const groupOps = ["group", "ungroup"] as const

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
  if (elements.length < (op === "group" ? 2 : 1)) return refused("elements")
  return { ok: true, change: { op, elements } }
}

export function groupChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "elements"],
    description:
      "Group two or more elements of one slide, or with op ungroup turn each group named back into its parts. Nothing moves. A new group's id comes back in elements.",
    properties: {
      op: { type: "string", enum: groupOps },
      elements: {
        type: "array",
        minItems: 1,
        maxItems: limits.batch,
        items: { type: "string" },
        description: "Element ids such as 258.7.",
      },
    },
  }
}
