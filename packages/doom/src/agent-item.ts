import { list, object, words } from "./read-kit.js"

export type AgentItem = {
  readonly title?: string
  readonly value?: string
  readonly note?: string
  readonly points?: readonly string[]
  readonly icon?: string
}

export const itemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    value: { type: "string", description: "A number or a date." },
    note: { type: "string" },
    points: { type: "array", items: { type: "string" }, description: "One bullet each." },
    icon: { type: "string", description: "An icon name." },
  },
}
export const readItem = object(
  {},
  { title: words(300), value: words(100), note: words(500), points: list(words(500), 12), icon: words(80, 1) },
)
