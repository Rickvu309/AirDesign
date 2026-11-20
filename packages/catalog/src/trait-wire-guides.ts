import type { TraitWire } from "./trait-wire.js"

const red = "FF0000"

export const guidesWire: TraitWire<"guides"> = {
  description: "Slides only. Whole lists.",
  fields: {
    ruler: {
      description: "x: vertical line, offset from the left; y: from the top.",
      example: { guides: { ruler: [{ axis: "x", offset: 36 }] } },
    },
    layout: {
      description: "size: grid square, or fixed column width; offset: margin, or from the aligned edge.",
      example: {
        guides: {
          layout: [
            {
              pattern: "columns",
              count: 12,
              align: "stretch",
              size: 0,
              offset: 36,
              gutter: 12,
              color: `#${red}`,
              opacity: 10,
              shown: true,
            },
          ],
        },
      },
    },
  },
}
