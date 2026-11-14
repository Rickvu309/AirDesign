import type { Kind } from "@airdesign/document"
import type { PaintFill } from "@airdesign/pptx"

type Named = Exclude<PaintFill["type"], "solid" | "none">

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  template: "Template",
  templateOff: "Templates are not available yet",
  background: "Background",
  color: "Color",
  picture: "Picture",
  pictureOff: "Picture, not available yet",
  colors: "Colors",
  white: "White",
  fills: { gradient: "Gradient", pattern: "Pattern", picture: "Picture" },
  kinds: {
    deck: "Deck",
    theme: "Theme",
    master: "Slide master",
    layout: "Layout",
    section: "Section",
    slide: "Slide",
    notes: "Speaker notes",
    shape: "Shape",
    picture: "Picture",
    connector: "Line",
    group: "Group",
    table: "Table",
    row: "Table row",
    cell: "Table cell",
    chart: "Chart",
    kept: "Element",
  },
  nothing: "Nothing on this element can be changed here yet.",
  refused: "Unable to make that change. The element stays as it was.",
  mixed: "Mixed",
  points: "pt",
  percent: "%",
  degrees: "°",
  addStop: "Add stop",
  remove: "Remove",
  removeStop: (number: number) => `Remove stop ${String(number)}`,
  stop: (number: number) => `Stop ${String(number)}`,
  cell: (row: number, column: number) => `Row ${String(row)}, column ${String(column)}`,
} as const satisfies {
  readonly fills: Record<Named, string>
  readonly kinds: Record<Kind, string>
  readonly [key: string]: unknown
}
