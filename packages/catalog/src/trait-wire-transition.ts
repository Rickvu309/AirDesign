import type { TraitWire } from "./trait-wire.js"

export const transitionWire: TraitWire<"transition"> = {
  description: "How a slide arrives in Present.",
  fields: {
    value: {
      description: "Omit: none on click, or the file's own.",
      example: { transition: { value: { dissolve: { duration: 500, advance: "click" } } } },
    },
  },
}
