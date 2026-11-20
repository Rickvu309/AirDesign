import type { TraitWire } from "./trait-wire.js"

export const identityWire: TraitWire<"identity"> = {
  description: "Its name, whether it shows, its lock and mask.",
  fields: {
    name: { description: "Selection Pane name.", example: { identity: { name: "Launch icon" } } },
    alt: { example: { identity: { alt: "A rocket lifting off" } } },
    hidden: { example: { identity: { hidden: true } } },
    locked: { example: { identity: { locked: true } } },
    mask: {
      description: "true clips the layers above it in its group to its shape; it does not paint.",
      example: { identity: { mask: true } },
    },
  },
}
