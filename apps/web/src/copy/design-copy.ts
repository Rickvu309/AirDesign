import type { PaintFill } from "@airdesign/pptx"
import type { PanelKind } from "@/design/panel-order"

type Named = Exclude<PaintFill["type"], "solid" | "none">

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  background: "Background",
  backgroundColor: (name: string) => `Background color, ${name}`,
  white: "White",
  fills: { gradient: "Gradient", pattern: "Pattern", picture: "Picture" },
  panels: {
    text: "Text box",
    shape: "Shape",
    picture: "Picture",
    connector: "Line",
    group: "Group",
    table: "Table",
    chart: "Chart",
    kept: "Element",
  },
  nothing: "Nothing on this element can be changed here yet.",
  refused: "Unable to make that change. Select the element and try again, or reload the deck if it keeps happening.",
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
  readonly panels: Record<PanelKind, string>
  readonly [key: string]: unknown
}
