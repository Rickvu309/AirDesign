import type { TraitWire } from "./trait-wire.js"

export const transitionWire: TraitWire<"transition"> = {
  description: "How a slide arrives when presenting.",
  fields: {
    value: {
      description:
        "Omit for on click with no transition, or when the file keeps one this cannot say; setting it replaces that.",
      example: { transition: { value: { dissolve: { duration: 500, advance: "click" } } } },
    },
  },
}
