import { templateCopy } from "./template-copy"
import { appearanceCopy } from "./appearance-copy"
import type { PaintFill } from "@airdesign/pptx"
import { nameTooLongOf } from "./product-copy"
import { frameCopy } from "./frame-copy"
import type { PanelKind } from "@/design/panel-order"

type Named = Exclude<PaintFill["type"], "solid" | "none">

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  background: "Background",
  selectOneSlide: "Select one slide to change its design.",
  selectSlide: "Select a slide to change its design.",
  designMode: "Design mode",
  ...templateCopy,
  backgroundColor: (name: string) => `Background color, ${name}`,
  ...appearanceCopy,
  white: "White",
  fills: { gradient: "Gradient", pattern: "Pattern", picture: "Image" },
  panels: {
    text: "Text",
    shape: "Shape",
    picture: "Image",
    connector: "Line",
    group: "Group",
    frame: frameCopy.frame,
    table: "Table",
    chart: "Chart",
    kept: "Layer",
  },
  selected: (count: number) => `${String(count)} selected`,
  selectMatching: "Select matching layers",
  noMatching: "No matching layers found.",
  multiEditText: "Multi-edit text",
  titles: { text: "Text", picture: "Image" },
  autoFrame: frameCopy.autoFrame,
  removeAutoLayout: frameCopy.removeAutoLayout,
  resizeToFit: frameCopy.resizeToFit,
  square: "Rectangle",
  fillDetails: "Fill details",
  nothing: "Nothing on this layer can be changed here yet.",
  refused: "Unable to make that change. Select the layer and try again, or reload the deck if it keeps happening.",
  tooLong: (max: number, wide: boolean) =>
    wide ? `${nameTooLongOf(max)} Some letters and emoji count as 2 to 4.` : nameTooLongOf(max),
  textTooLong: (max: number, wide: boolean) =>
    `Use less text. This box holds up to ${new Intl.NumberFormat("en").format(max)} characters, including formatting.${wide ? " Some letters and emoji count as 2 to 4." : ""}`,
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
  readonly panels: Record<Exclude<PanelKind, "many">, string>
  readonly [key: string]: unknown
}
