import type { TraitWire } from "./trait-wire.js"

export const connectionWire: TraitWire<"connection"> = {
  description: "Attach ends to numbered sites on same-slide shapes or images. none detaches.",
  fields: {
    start: {
      example: { connection: { start: { shape: { node: "324.6", site: 0 } } } },
    },
    end: {
      example: { connection: { end: { shape: { node: "324.15", site: 3 } } } },
    },
  },
}
