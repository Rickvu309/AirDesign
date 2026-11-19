import type { TraitWire } from "./trait-wire.js"

export const transitionWire: TraitWire<"transition"> = {
  description: "How a slide arrives in Present.",
  fields: {
    value: {
      description: "Omit for none on click or a file's own transition; setting replaces it.",
      example: { transition: { value: { dissolve: { duration: 500, advance: "click" } } } },
    },
  },
}
