import { type NodeId, readNodeId } from "./ids.js"
import { type Px, px } from "./paint.js"
import { type Reader, finite, literal, object, oneOf, reject } from "./read-kit.js"

const sideWords = ["top", "right", "bottom", "left", "center"] as const

export type AgentEnd =
  | { readonly layer: NodeId; readonly side?: (typeof sideWords)[number]; readonly along?: number }
  | { readonly x: Px; readonly y: Px }

export const endSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["layer"],
      properties: {
        layer: { $ref: "#/$defs/id" },
        side: { enum: sideWords },
        along: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: { x: { type: "number" }, y: { type: "number" } },
    },
  ],
}

export const readEnd: Reader<AgentEnd> = oneOf<AgentEnd>(
  object({ layer: (raw) => readNodeId(raw) ?? reject() }, { side: literal(sideWords), along: finite(0, 1) }),
  object({ x: px(), y: px() }),
)
