import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const textWire: TraitWire<"text"> = {
  description: "Styles all runs or paragraphs of current text or supplied value.",
  fields: {
    value: {
      description:
        "Plain text keeps the first run's look. JSON [{from,runs:[{from,text,link?}]}] keeps file indexes; -1 adds a run. Run link: {kind:'url',url:'https://…'}, {kind:'slide',slide:'ID'} or {kind:'none'}; omit it to keep it.",
      example: { text: { value: "Quarterly review" } },
    },
    fill: {
      description: "Letter fill in the shape fill form: solid, gradient or image.",
      example: { text: { fill: { solid: "accent1" } } },
    },
    color: {
      description: `Template color, such as accent1 or tx1, or #${navy}; optional transforms: accent1 lumMod 75.`,
      example: { text: { color: "accent1" } },
    },
    size: { description: "Points.", example: { text: { size: 28 } } },
    font: {
      description:
        "Typeface, such as Georgia or portable Lato Light, Thin, ExtraLight, Medium, SemiBold, ExtraBold or Black.",
      example: { text: { font: "Georgia" } },
    },
    bold: { example: { text: { bold: true } } },
    italic: { example: { text: { italic: true } } },
    underline: { example: { text: { underline: true } } },
    align: { example: { text: { align: "center" } } },
    list: { description: "numbers uses decimals.", example: { text: { list: "numbers" } } },
    case: { example: { text: { case: "small" } } },
    strike: { description: "Single strikethrough.", example: { text: { strike: true } } },
    letterSpacing: {
      description: "Points. Negative tightens.",
      example: { text: { letterSpacing: 1.5 } },
    },
    lineHeight: { description: "Line height in percent; 100 is single.", example: { text: { lineHeight: 150 } } },
    spaceBefore: { description: "Space above each paragraph, in points.", example: { text: { spaceBefore: 12 } } },
    style: {
      description: "textStyles id from read_deck with slide set. Explicit fields win.",
      example: { text: { style: "ppt/slideMasters/slideMaster1.xml/titleStyle/0" } },
    },
    spaceAfter: { description: "Space below each paragraph, in points.", example: { text: { spaceAfter: 6 } } },
  },
}
