import type { TraitWire } from "./trait-wire.js"

export const textWire: TraitWire<"text"> = {
  description: "The element's text.",
  fields: {
    value: {
      description:
        "Plain text replaces all of it and keeps the format of the first run. A JSON text value, [{from, runs: [{from, text}]}], keeps the file's paragraphs and runs: each from is an index the file has, and -1 is a new one.",
      example: { text: { value: "Quarterly review" } },
    },
  },
}
