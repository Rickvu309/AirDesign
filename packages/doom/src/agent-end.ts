import { type NodeId, readNodeId } from "./ids.js"
import { type Px, px } from "./paint.js"
import { type Reader, literal, object, oneOf, reject } from "./read-kit.js"

const sideWords = ["top", "right", "bottom", "left", "center"] as const

export type AgentEnd =
  | { readonly layer: NodeId; readonly side?: (typeof sideWords)[number] }
  | { readonly x: Px; readonly y: Px }

export const endSchema = (description: string) => ({
  description,
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["layer"],
      properties: {
        layer: { $ref: "#/$defs/id" },
        side: { enum: sideWords, description: "Left out: the side facing the other end." },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: { x: { type: "number" }, y: { type: "number" } },
    },
  ],
})

export const readEnd: Reader<AgentEnd> = oneOf<AgentEnd>(
  object({ layer: (raw) => readNodeId(raw) ?? reject() }, { side: literal(sideWords) }),
  object({ x: px(), y: px() }),
)
