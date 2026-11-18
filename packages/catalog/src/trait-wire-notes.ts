import type { TraitWire } from "./trait-wire.js"

export const notesWire: TraitWire<"notes"> = {
  description: "The slide's presenter notes.",
  fields: {
    value: {
      description: "Plain text. Each line break starts a new paragraph.",
      example: { notes: { value: "Open with the result, then the plan." } },
    },
  },
}
