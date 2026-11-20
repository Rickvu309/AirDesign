import type { TraitWire } from "./trait-wire.js"

export const layoutWire: TraitWire<"layout"> = {
  description: "A frame's auto layout.",
  fields: {
    flow: { description: "Row, column, or none to free the children.", example: { layout: { flow: "vertical" } } },
    gap: { description: "Points between children.", example: { layout: { gap: 16 } } },
    padding: {
      description: "Points inside each edge.",
      example: { layout: { padding: { left: 8, top: 8, right: 8, bottom: 8 } } },
    },
    align: { description: "Where the children sit.", example: { layout: { align: "center" } } },
  },
}
