import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const textWire: TraitWire<"text"> = {
  description:
    "Run fields apply to every run; align, list and paragraph spacing to every paragraph. Uses current text, or value when sent.",
  fields: {
    value: {
      description:
        "Plain text keeps the first run's look. JSON [{from,runs:[{from,text,link?}]}] keeps file indexes; -1 adds a run. Run link: {kind:'url',url:'https://…'}, {kind:'slide',slide:'ID'}, or {kind:'none'} to remove. Omit link to preserve it.",
      example: { text: { value: "Quarterly review" } },
    },
    color: {
      description: `Theme color, such as accent1 or tx1, or #${navy}; optional transforms: accent1 lumMod 75.`,
      example: { text: { color: "accent1" } },
    },
    size: { description: "Size in points, 1 to 4000.", example: { text: { size: 28 } } },
    font: { description: "Font face, such as Georgia.", example: { text: { font: "Georgia" } } },
    bold: { description: "Bold on or off.", example: { text: { bold: true } } },
    italic: { description: "Italic on or off.", example: { text: { italic: true } } },
    underline: { description: "Underline on or off.", example: { text: { underline: true } } },
    align: { description: "left, center or right.", example: { text: { align: "center" } } },
    list: { description: "none, bullets or decimal numbers.", example: { text: { list: "numbers" } } },
    strike: { description: "Single strikethrough on or off.", example: { text: { strike: true } } },
    letterSpacing: {
      description: "Letter spacing in points; negative tightens.",
      example: { text: { letterSpacing: 1.5 } },
    },
    lineSpacing: { description: "Line spacing in percent; 100 is single.", example: { text: { lineSpacing: 150 } } },
    spaceBefore: { description: "Space above each paragraph, in points.", example: { text: { spaceBefore: 12 } } },
    spaceAfter: { description: "Space below each paragraph, in points.", example: { text: { spaceAfter: 6 } } },
  },
}
