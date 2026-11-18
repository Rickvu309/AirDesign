import type { TraitWire } from "./trait-wire.js"

export const transitionWire: TraitWire<"transition"> = {
  description: "How a slide arrives when presenting.",
  fields: {
    value: {
      description:
        "Omit when it arrives on click with no transition, or when the file keeps a transition this value cannot say. Setting it replaces that kept transition.",
      example: { transition: { value: { dissolve: { duration: 500, advance: "click" } } } },
    },
  },
}
