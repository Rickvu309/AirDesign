import type { TraitWire } from "./trait-wire.js"

export const connectionWire: TraitWire<"connection"> = {
  description:
    "A connector's ends. Each attaches to a numbered site on a shape or picture of its slide and follows it when it moves; none frees it.",
  fields: {
    start: {
      description: "Where the start attaches.",
      example: { connection: { start: { shape: { node: "324.6", site: 0 } } } },
    },
    end: {
      description: "Where the end attaches.",
      example: { connection: { end: { shape: { node: "324.15", site: 3 } } } },
    },
  },
}
