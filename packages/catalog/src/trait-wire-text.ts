import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const textWire: TraitWire<"text"> = {
  description:
    "The element's text. color, size, font, bold, italic and underline apply to every run, and align, bullet and spacing to every paragraph, of the text the element holds now, or of value when you send it too.",
  fields: {
    value: {
      description:
        "Plain text replaces all of it and keeps the format of the first run. A JSON text value, [{from, runs: [{from, text}]}], keeps the file's paragraphs and runs: each from is an index the file has, and -1 is a new one.",
      example: { text: { value: "Quarterly review" } },
    },
    color: {
      description: `Text color: a theme color such as "accent1" or "tx1", or "#${navy}", each optionally followed by transforms such as "accent1 lumMod 75".`,
      example: { text: { color: "accent1" } },
    },
    size: { description: "Type size in points, from 1 to 4000.", example: { text: { size: 28 } } },
    font: { description: "Font face, such as Georgia.", example: { text: { font: "Georgia" } } },
    bold: { description: "true for bold, false for regular weight.", example: { text: { bold: true } } },
    italic: { description: "true for italic, false for upright.", example: { text: { italic: true } } },
    underline: { description: "true to underline, false for none.", example: { text: { underline: true } } },
    align: { description: "left, center or right.", example: { text: { align: "center" } } },
    bullet: {
      description: "true for a bullet before each paragraph, false for none.",
      example: { text: { bullet: true } },
    },
    lineSpacing: { description: "Line spacing in percent; 100 is single.", example: { text: { lineSpacing: 150 } } },
    spaceBefore: { description: "Space above each paragraph, in points.", example: { text: { spaceBefore: 12 } } },
    spaceAfter: { description: "Space below each paragraph, in points.", example: { text: { spaceAfter: 6 } } },
  },
}
